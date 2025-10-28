#!/bin/bash
# Convert Apple certificate to P12 format (required by Fastlane Match)

echo "🔄 Converting Apple Distribution Certificate to P12 format"
echo ""

if [ ! -f "distribution.key" ]; then
  echo "❌ Error: distribution.key not found!"
  echo "Run ./generate-csr.sh first"
  exit 1
fi

if [ ! -f "distribution.cer" ]; then
  echo "❌ Error: distribution.cer not found!"
  echo ""
  echo "Please download your certificate from Apple Developer Portal:"
  echo "1. Go to: https://developer.apple.com/account/resources/certificates/list"
  echo "2. Find your Apple Distribution certificate"
  echo "3. Download it and save as 'distribution.cer' in this directory"
  exit 1
fi

echo "Converting .cer to .pem..."
openssl x509 -in distribution.cer -inform DER -out distribution.pem -outform PEM

echo "Creating .p12 file..."
read -sp "Enter a password for the P12 file (save this for later!): " PASSWORD
echo ""

openssl pkcs12 -export -out distribution.p12 \
  -inkey distribution.key \
  -in distribution.pem \
  -password pass:$PASSWORD

echo ""
echo "✅ Done! Created distribution.p12"
echo ""
echo "⚠️  IMPORTANT: Save the password you just entered!"
echo "You'll need it when setting up Fastlane Match."
