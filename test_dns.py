import socket
import struct
import ssl

# Direct TCP connection to RDS - bypass DNS
host = "kindswap-prod.cov8e4myuic2.us-east-1.rds.amazonaws.com"
print(f"Resolving {host}...")
ip = socket.gethostbyname(host)
print(f"Resolved to: {ip}")
