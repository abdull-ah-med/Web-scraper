#!/bin/bash

# AI University Scraper - Post-Deployment Setup Script
# Run this after successful Railway deployment

echo "🚀 AI University Scraper - Post-Deployment Setup"
echo "================================================"

# Wait for database connection
echo "⏳ Waiting for database connection..."
sleep 10

# Seed database with Pakistani universities
echo "🌱 Seeding database with Pakistani universities..."
node "data/seed-universities.js" --sample-data

if [ $? -eq 0 ]; then
    echo "✅ Database seeded successfully!"
else
    echo "❌ Database seeding failed"
    echo "   You can run this manually later"
fi

echo ""
echo "🎉 Setup completed!"
echo "📚 Your API is now ready!" 