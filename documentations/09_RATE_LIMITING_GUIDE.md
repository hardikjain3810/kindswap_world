# ⚙️ RATE LIMITING CONFIGURATION GUIDE (v5 NEW)

**Document Version:** v5 (New in v5)  
**Date:** March 28, 2026  
**Audience:** DevOps, Backend Engineers, Site Reliability  

---

## 🎯 OVERVIEW: TWO-LAYER RATE LIMITING

KindSwap implements rate limiting at two levels for defense-in-depth:

```
LAYER 1: Cloudflare Edge (DDoS Protection)
├─ Threshold: 100 requests per 10 seconds
├─ Action: CAPTCHA challenge (rate limit exceeded)
├─ Scope: All requests to kindswap.world
└─ Purpose: Absorb volumetric attacks before they reach AWS

       ↓ (only requests below limit pass through)

LAYER 2: NestJS Application (API Protection)
├─ Threshold: 15 requests per 60 seconds
├─ Action: 429 Too Many Requests
├─ Scope: All /api/* routes (per IP)
└─ Purpose: Fair resource allocation, prevent DB overload

       ↓ (only requests below limit reach database)

Result: Legitimate users unaffected (~5-10 req/min typical)
```

---

## 🌐 LAYER 1: CLOUDFLARE EDGE RULE SETUP

### Terraform Configuration

```hcl
# Location: infra/infra-core/03-cdn/main.tf

resource "cloudflare_rate_limit" "api_protection" {
  zone_id   = cloudflare_zone.kindswap.id
  disabled  = false
  
  # Rate limit: 100 requests per 10-second period
  threshold = 100
  period    = 10
  
  # Identify client by: IP address (default)
  counting_expression = "true"
  
  # Apply to: All requests matching /api/* path
  match {
    request {
      url {
        path {
          matches = "/api/*"
        }
      }
    }
  }
  
  # Action: Show CAPTCHA
  action {
    mode = "challenge"
    timeout_seconds = 3600  # Session valid for 1 hour
  }
  
  # Bypass: Don't rate-limit health checks
  bypass_url_patterns = [
    "*.kindswap.world/health",
    "*.kindswap.world/status"
  ]
}
```

### How Cloudflare Rate Limiting Works

```
Request 1-100 in 10 seconds:
├─ IP: 203.0.113.45
├─ Path: /api/v1/swap
├─ Action: Forward to ALB (200 OK)
└─ Result: Normal request

Request 101 in same 10-second window:
├─ IP: 203.0.113.45
├─ Path: /api/v1/swap
├─ Action: Return CAPTCHA page (challenge)
└─ Result: Browser must solve puzzle

User solves CAPTCHA:
├─ Browser: Submits CAPTCHA solution
├─ Cloudflare: Verifies solution
├─ If valid: Issues session cookie (1 hour valid)
└─ Result: Next 100 requests pass without CAPTCHA

After session expires:
├─ Old cookie: No longer valid
├─ New request: Shows CAPTCHA again
└─ Cycle repeats
```

### Bypassing Rate Limit

```
Cloudflare Challenge (CAPTCHA):
├─ Shown to: Requests over 100/10s
├─ Solves: User clicks "I'm not a robot" or solves puzzle
├─ Valid for: 1 hour per session
├─ Legitimate users: Can proceed after CAPTCHA

Attack bots:
├─ Cannot solve CAPTCHA: Most bots can't
├─ Request blocked: After timeout (3600 seconds)
├─ Result: Botnet traffic blocked before reaching AWS
```

---

## 📝 LAYER 2: NESTJS APPLICATION THROTTLER

### Configuration (Code)

```typescript
// Location: backend/src/app.module.ts

import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 60000,      // 60 seconds (1 minute)
        limit: 15,       // 15 requests per minute
      },
      {
        name: 'long',
        ttl: 3600000,    // 3600 seconds (1 hour)
        limit: 300,      // 300 requests per hour
      },
    ]),
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
```

### Excluding Routes (No Rate Limit)

```typescript
// Location: backend/src/app.controller.ts

import { SkipThrottle } from '@nestjs/throttler';

@Controller('api')
export class AppController {
  // Rate limit applied (default)
  @Post('/v1/swap')
  async executeSwap(@Body() body: SwapRequest) {
    // Rate limited: 15 requests/60s
    return { ... };
  }

  // Rate limit SKIPPED
  @SkipThrottle()
  @Get('/health')
  async health() {
    // No rate limit: Always respond
    return { status: 'ok' };
  }

  // Rate limit SKIPPED
  @SkipThrottle()
  @Get('/status')
  async status() {
    // No rate limit: Always respond
    return { running: true };
  }
}
```

### How NestJS Rate Limiting Works

```
Request 1-15 in 60 seconds from 10.50.50.5:
├─ IP: 10.50.50.5
├─ Endpoint: POST /api/v1/swap
├─ Counter: 1/15
└─ Response: 200 OK (request processed)

Request 2-15: Similar (200 OK, counter increments)

Request 16 in same 60-second window:
├─ IP: 10.50.50.5
├─ Endpoint: POST /api/v1/swap
├─ Counter: 16/15 (EXCEEDED)
├─ Response: 429 Too Many Requests
├─ Headers:
│  ├─ Retry-After: 60
│  └─ X-RateLimit-Limit: 15
└─ Result: Client must wait 60 seconds

After 60 seconds elapse:
├─ Counter: RESET to 0/15
├─ Next request: Starts new 60-second window
└─ Result: Client can make 15 more requests
```

### Rate Limit Response

```
HTTP/1.1 429 Too Many Requests
Content-Type: application/json
Retry-After: 60
X-RateLimit-Limit: 15
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1711610400

{
  "statusCode": 429,
  "message": "Too Many Requests",
  "details": "You have exceeded 15 requests per 60 seconds limit. Please try again in 60 seconds."
}
```

---

## 🔧 ADJUSTING RATE LIMITS

### Change Limits Per Environment

```typescript
// Location: backend/src/config/throttle.config.ts

interface ThrottleConfig {
  environment: 'dev' | 'staging' | 'production';
  short: { ttl: number; limit: number };
  long: { ttl: number; limit: number };
}

const configs: Record<string, ThrottleConfig> = {
  dev: {
    environment: 'dev',
    short: { ttl: 60000, limit: 1000 },  // Relaxed in dev
    long: { ttl: 3600000, limit: 10000 },
  },
  staging: {
    environment: 'staging',
    short: { ttl: 60000, limit: 100 },   // Moderate in staging
    long: { ttl: 3600000, limit: 1000 },
  },
  production: {
    environment: 'production',
    short: { ttl: 60000, limit: 15 },    // Strict in prod
    long: { ttl: 3600000, limit: 300 },
  },
};

// Usage in app.module.ts
const config = configs[process.env.ENVIRONMENT || 'production'];

ThrottlerModule.forRoot([
  {
    name: 'short',
    ttl: config.short.ttl,
    limit: config.short.limit,
  },
  {
    name: 'long',
    ttl: config.long.ttl,
    limit: config.long.limit,
  },
]);
```

### Dynamic Rate Limiting (Per-User)

```typescript
// Location: backend/src/guards/custom-throttle.guard.ts

import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class CustomThrottleGuard extends ThrottlerGuard {
  protected getTracker(req: Record<string, any>): string {
    // By default, uses IP address
    // Can override to use authenticated user ID:
    
    if (req.user) {
      // Authenticated user: Rate limit per user ID
      return req.user.id;
    }
    
    // Unauthenticated: Rate limit per IP
    return req.ip;
  }
}
```

---

## 📊 MONITORING RATE LIMIT METRICS

### Grafana Dashboard

```
Metrics to monitor:

1. Rate Limit Hit Count
   ├─ Query: rate(http_429_total[5m])
   ├─ Alert: If > 100/5min, investigate
   └─ Meaning: Many clients hitting rate limit

2. Request Rate by IP
   ├─ Query: topk(10, rate(http_requests_total[1m]) by (client_ip))
   ├─ Shows: Top 10 IPs by request rate
   └─ Alert: If any IP > 200/min, likely attack

3. Cloudflare CAPTCHA Success Rate
   ├─ Query: rate(cloudflare_challenges_passed[5m]) / rate(cloudflare_challenges_total[5m])
   ├─ Shows: % of users passing CAPTCHA
   ├─ Normal: 90%+ (legitimate users)
   └─ Alert: If < 50%, may indicate attack

4. API Latency During Rate Limiting
   ├─ Query: histogram_quantile(0.99, http_request_duration_seconds)
   ├─ Shows: 99th percentile latency
   ├─ Normal: 100-500ms
   └─ Alert: If > 5 seconds, DB overload
```

### CloudWatch Logs

```bash
# Filter for 429 errors
$ aws logs filter-log-events \
    --log-group-name /aws/eks/production/backend \
    --filter-pattern '429' \
    --start-time $(date -d '1 hour ago' +%s)000

# Output:
# 2026-03-28T13:45:30Z [WARN] 429 response from 203.0.113.45 - rate limited

# Check for patterns:
# - Single IP making many requests? (attack)
# - Distributed across IPs? (legitimate spike)
# - Time correlation? (marketing campaign, news mention)
```

### Application Metrics (NestJS)

```typescript
// Location: backend/src/app.module.ts

import { PrometheusModule } from '@nestjs/prometheus';

@Module({
  imports: [
    PrometheusModule.register({
      defaultMetrics: { enabled: true },
    }),
  ],
})

// Custom metrics for rate limiting
import { Counter } from 'prom-client';

const rateLimitCounter = new Counter({
  name: 'http_rate_limit_exceeded_total',
  help: 'Total number of rate limit exceeded events',
  labelNames: ['endpoint', 'ip'],
});

// In controller
@Post('/api/v1/swap')
async swap() {
  // When 429 returned:
  rateLimitCounter.inc({
    endpoint: '/api/v1/swap',
    ip: req.ip,
  });
}
```

---

## ⚠️ HANDLING RATE LIMIT ISSUES

### Case 1: Legitimate User Hitting Rate Limit

**Symptom:** User complains "API returns 429 error"

**Diagnosis:**
```bash
# Check if user is making legitimate requests
$ kubectl logs -f deployment/kindswap-backend -n production \
    | grep "429" | grep "client_ip=203.0.113.45"

# If user is doing legitimate activity:
# - Batch swap requests (1 per 5 seconds instead of per second)
# - Use backend job queue for bulk operations
# - Or: Whitelist user's IP (temporary)
```

**Solution:**
```typescript
// Whitelist specific IP (temporary, until user upgrades plan)
const WHITELISTED_IPS = ['203.0.113.45'];  // Trusted partner

@Injectable()
export class CustomThrottleGuard extends ThrottlerGuard {
  protected getTracker(req: Record<string, any>): string {
    if (WHITELISTED_IPS.includes(req.ip)) {
      return 'whitelist';  // Different rate limit bucket
    }
    return req.ip;
  }
}

// Higher limit for whitelisted users:
ThrottlerModule.forRoot([
  {
    name: 'short',
    ttl: 60000,
    limit: 15,  // Normal limit
  },
  {
    name: 'whitelist',
    ttl: 60000,
    limit: 100,  // Higher limit
  },
]);
```

### Case 2: Attack (Sudden Spike)

**Symptom:** 429 errors spiking, many different IPs

**Diagnosis:**
```bash
# Check top IPs
$ kubectl logs -f deployment/kindswap-backend -n production \
    | grep "429" | awk '{print $NF}' | sort | uniq -c | sort -rn | head -20

# If concentrated on few IPs: Targeted attack
# If distributed: DDoS attack

# Check patterns:
# - Requests to endpoint X? (scraping attempt)
# - Requests to endpoint Y? (API fuzzing)
# - Random endpoints? (volumetric DDoS)
```

**Solution:**
```
IMMEDIATE (T+0):
1. Update Cloudflare threshold lower (e.g., 50/10s)
2. Enable stricter CAPTCHA challenge
3. Block suspicious IPs in CloudFlare WAF

SHORT-TERM (T+1 hour):
1. Add stricter NestJS rate limit (e.g., 5/60s)
2. Implement auto-scaling for more pods
3. Alert security team

LONG-TERM (T+1 day):
1. Analyze attack patterns
2. Add geo-blocking if needed
3. Implement IP reputation checks
```

### Case 3: Rate Limit Too Strict

**Symptom:** "Normal users can't use app"

**Diagnosis:**
```bash
# Check average request rate
$ kubectl logs deployment/kindswap-backend -n production \
    | tail -1000 | wc -l
# Divide by time window to get req/sec

# If legitimate traffic > limit: Increase limit
```

**Solution:**
```
Increase limit (if average traffic warrants):

Production limits:
├─ Short: 15/60s → 30/60s (double)
├─ Long: 300/3600s → 600/3600s (double)
└─ Test: Monitor for abuse

Cloudflare limits:
├─ Edge: 100/10s → 200/10s (if legitimate spike)
└─ Monitor: CAPTCHA success rate
```

---

## 📈 SCALING RATE LIMITS FOR GROWTH

```
At 1K users:
├─ Short: 15 requests/60s per IP
├─ Long: 300 requests/3600s per IP
└─ Result: One user can do 15 swaps/min (sufficient)

At 10K users:
├─ Short: 30 requests/60s per IP (doubled)
├─ Long: 600 requests/3600s per IP (doubled)
└─ Reasoning: Heavier legitimate load

At 30K users:
├─ Short: 50-100 requests/60s per IP
├─ Long: 1000+ requests/3600s per IP
├─ Switch: Per-user ID based (not just IP)
└─ Reason: Shared corporate networks, proxies
```

---

## ✅ BEST PRACTICES

```
1. Monitor 429 error rate
   └─ Alert if > 5% of total requests

2. Distinguish attacks from spikes
   └─ Analyze IP distribution, endpoint patterns

3. Communicate limits to users
   └─ Document in API documentation

4. Provide gradual backoff
   └─ Include Retry-After header (always)

5. Test rate limiting under load
   └─ Monthly load test with 50x traffic

6. Keep Cloudflare and NestJS synchronized
   └─ If one threshold changes, update both

7. Monitor for false positives
   └─ Whitelisting as last resort (temporary only)
```

---

**Document:** RATE LIMITING CONFIGURATION GUIDE  
**Status:** ✅ COMPLETE (NEW IN v5)  
**Version:** v5  
**Last Updated:** March 28, 2026
