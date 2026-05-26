#!/bin/bash
# Notification System Implementation Checklist
# এই ফাইল দিয়ে notification সিস্টেম পরীক্ষা করুন

echo "================================"
echo "Notification System Verification"
echo "================================"
echo ""

# Check 1: Files exist
echo "✓ Checking files..."
files=(
    "public/js/notification-navbar.js"
    "public/css/notification-navbar.css"
    "controllers/notificationController.js"
    "routes/notificationRoutes.js"
    "migrations/010_notifications.sql"
)

for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        echo "  ✓ $file found"
    else
        echo "  ✗ $file NOT found"
    fi
done

echo ""
echo "================================"
echo "Implementation Steps"
echo "================================"
echo ""

echo "Step 1: Run Database Migration"
echo "  Run: mysql -u root -p charity_platform < migrations/010_notifications.sql"
echo ""

echo "Step 2: Add scripts to HTML files"
echo "  Add to <head>:"
echo "    <link rel=\"stylesheet\" href=\"css/notification-navbar.css\">"
echo ""
echo "  Add before </body>:"
echo "    <script src=\"js/notification-navbar.js\"></script>"
echo ""

echo "Step 3: Files to add this to:"
echo "  - public/index.html"
echo "  - public/patient-dashboard.html"
echo "  - public/doctor-dashboard.html"
echo "  - public/admin-dashboard.html"
echo "  - public/lifeline-charity-team-dashboard.html"
echo ""

echo "Step 4: Test the notification system"
echo "  1. npm start"
echo "  2. Open browser to http://localhost:3000"
echo "  3. Login as patient"
echo "  4. Submit a case"
echo "  5. Logout and login as doctor"
echo "  6. Check for notification bell with count"
echo ""

echo "Step 5: Mark case as approved/rejected"
echo "  1. In doctor dashboard, approve or reject the case"
echo "  2. Logout and login as patient"
echo "  3. Check for approval/rejection notification"
echo ""

echo "================================"
echo "API Endpoints to Test"
echo "================================"
echo ""
echo "Get notifications:"
echo "  curl -H 'Authorization: Bearer YOUR_TOKEN' \\"
echo "       http://localhost:3000/api/notifications"
echo ""
echo "Get unread count:"
echo "  curl -H 'Authorization: Bearer YOUR_TOKEN' \\"
echo "       http://localhost:3000/api/notifications/unread/count"
echo ""

echo "================================"
echo "Done!"
echo "================================"
