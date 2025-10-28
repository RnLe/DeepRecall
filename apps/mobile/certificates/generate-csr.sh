#!/bin/bash
# Generate Certificate Signing Request (CSR) for Apple Distribution Certificate
# This works on Linux without needing a Mac

echo "🔐 Generating Apple Distribution Certificate CSR on Linux"
echo ""
echo "This will create:"
echo "  - distribution.key (private key - KEEP THIS SAFE!)"
echo "  - distribution.csr (certificate signing request - upload to Apple)"
echo ""

# Prompt for user details
read -p "Enter your email address: " EMAIL
read -p "Enter your full name: " NAME
read -p "Enter your country code (e.g., US, DE, UK): " COUNTRY

echo ""
echo "Generating private key..."
openssl genrsa -out distribution.key 2048

echo "Generating CSR..."
openssl req -new -key distribution.key -out distribution.csr \
  -subj "/emailAddress=$EMAIL/CN=$NAME/C=$COUNTRY"

echo ""
echo "✅ Done! Files created:"
echo "  📁 distribution.key (private key - DO NOT SHARE OR COMMIT)"
echo "  📄 distribution.csr (upload this to Apple Developer Portal)"
echo ""
echo "Next steps:"
echo "1. Go to: https://developer.apple.com/account/resources/certificates/add"
echo "2. Select 'Apple Distribution'"
echo "3. Upload distribution.csr"
echo "4. Download the certificate (distribution.cer)"
echo "5. Run: ./convert-to-p12.sh"
