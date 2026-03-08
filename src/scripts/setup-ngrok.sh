#!/bin/bash

# Script to help set up ngrok for Flutterwave webhook testing

echo "🚀 Setting up ngrok for Flutterwave Webhook Testing"
echo "==================================================="
echo ""

# Check if ngrok is installed
if ! command -v ngrok &> /dev/null; then
    echo "❌ ngrok is not installed"
    echo ""
    echo "📦 Installation options:"
    echo ""
    echo "Option 1: Snap (Ubuntu/Debian)"
    echo "  sudo snap install ngrok"
    echo ""
    echo "Option 2: Direct download"
    echo "  Download from: https://ngrok.com/download"
    echo "  Unzip and add to PATH"
    echo ""
    echo "Option 3: npm"
    echo "  npm install -g ngrok"
    echo ""
    echo "After installation, run this script again."
    exit 1
fi

echo "✅ ngrok is installed"
echo ""

# Check if ngrok is authenticated
if [ ! -f ~/.ngrok2/ngrok.yml ]; then
    echo "🔑 ngrok is not authenticated"
    echo ""
    echo "To authenticate ngrok:"
    echo "1. Sign up at https://ngrok.com"
    echo "2. Get your authtoken from dashboard"
    echo "3. Run: ngrok config add-authtoken YOUR_AUTH_TOKEN"
    echo ""
    echo "After authentication, run this script again."
    exit 1
fi

echo "✅ ngrok is authenticated"
echo ""

# Check if backend server is running
if ! curl -s http://localhost:4000 > /dev/null; then
    echo "⚠️  Backend server is not running at http://localhost:4000"
    echo ""
    echo "Start the server with:"
    echo "  pnpm start:dev"
    echo ""
    read -p "Do you want to start the server now? (y/n): " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Starting server in background..."
        pnpm start:dev &
        SERVER_PID=$!
        echo "Server started with PID: $SERVER_PID"
        echo "Waiting 5 seconds for server to start..."
        sleep 5
    else
        echo "Please start the server manually and run this script again."
        exit 1
    fi
fi

echo "✅ Backend server is running at http://localhost:4000"
echo ""

# Start ngrok
echo "🌐 Starting ngrok..."
echo ""
echo "This will create a public URL that forwards to your local server."
echo "Press Ctrl+C to stop ngrok when done."
echo ""

# Start ngrok in background and capture output
ngrok http 4000 > ngrok.log 2>&1 &
NGROK_PID=$!

echo "ngrok started with PID: $NGROK_PID"
echo "Logs are being written to: ngrok.log"
echo ""

# Wait for ngrok to start and get URL
echo "⏳ Waiting for ngrok to start (5 seconds)..."
sleep 5

# Try to get ngrok URL from logs
NGROK_URL=$(grep -o "https://[a-zA-Z0-9]*\.ngrok\.io" ngrok.log | head -1)

if [ -z "$NGROK_URL" ]; then
    echo "❌ Could not get ngrok URL from logs"
    echo "Check ngrok.log for errors"
    kill $NGROK_PID 2>/dev/null
    exit 1
fi

echo "✅ ngrok is running!"
echo ""
echo "📡 Your public URL is: $NGROK_URL"
echo ""

# Display Flutterwave dashboard instructions
echo "📋 Flutterwave Dashboard Configuration"
echo "--------------------------------------"
echo ""
echo "1. Go to: https://dashboard.flutterwave.com"
echo "2. Navigate to Settings > Webhooks"
echo "3. Add new webhook:"
echo "   - URL: $NGROK_URL/offramp/webhook"
echo "   - Secret: Manofgod123. (or your custom secret)"
echo "   - Events: Select all transfer events"
echo ""
echo "4. Save the webhook configuration"
echo ""

# Display test instructions
echo "🧪 Testing Instructions"
echo "----------------------"
echo ""
echo "1. Test webhook signature verification:"
echo "   ./test-webhook.sh"
echo ""
echo "2. Test Flutterwave integration:"
echo "   ./test-flutterwave-integration.sh"
echo ""
echo "3. Monitor ngrok traffic:"
echo "   tail -f ngrok.log"
echo ""
echo "4. Monitor server logs:"
echo "   tail -f logs/server.log"
echo ""
echo "5. To stop ngrok:"
echo "   kill $NGROK_PID"
echo ""

# Create a test webhook URL file
echo "$NGROK_URL/offramp/webhook" > webhook-url.txt
echo "📝 Webhook URL saved to: webhook-url.txt"
echo ""

echo "🎉 Setup complete! Your Flutterwave webhook is ready for testing."
echo ""
echo "💡 Tip: Keep this terminal open while testing."
echo "      ngrok will show incoming webhook requests here."