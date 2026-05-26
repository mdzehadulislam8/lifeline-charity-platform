# Lifeline Charity Platform

A comprehensive web-based charity platform designed for Bangladesh that facilitates crowdfunding for medical cases and blood donations. The platform connects patients in need with compassionate donors through a transparent, secure, and efficient digital ecosystem.

## Overview

Lifeline Charity Platform is a full-stack web application that streamlines the entire fundraising workflow: from patient case submissions and doctor verification to admin approvals and donor contributions. The platform supports multiple payment methods tailored for the Bangladesh market and includes features for real-time notifications, case management, and comprehensive reporting.

## Tech Stack

**Backend:**
- Node.js with Express.js
- MySQL 2 database with promise-based queries
- JWT for authentication
- Bcryptjs for password encryption
- Multer for file uploads
- Stripe payment integration

**Frontend:**
- HTML5, CSS3, JavaScript
- Responsive design
- Real-time WebSocket support (Socket.io)
- Axios for HTTP requests

**DevOps & Tools:**
- Git version control
- Environment-based configuration (.env)
- JSON-based configuration files

## Key Features

**Authentication & User Management**
- Multi-role user system (Patient, Doctor, Donor, Admin, Blood Donor)
- JWT-based authentication
- Session management with token expiration
- Password encryption with bcryptjs

**Case Management**
- Patient case submission with medical details
- File uploads (prescriptions, NID documents)
- Doctor review and verification workflow
- Admin approval and publication system
- Case tracking with status updates

**Blood Donation System**
- Blood availability tracking by blood type
- Blood request management
- Donor registration and verification
- Blood case submissions and approvals

**Payment & Fundraising**
- Stripe payment integration for secure transactions
- Multiple payment methods support
- Donation tracking and receipts
- Payout management for beneficiaries
- Transaction history and reporting

**Notifications**
- Real-time donation notifications
- Case status updates
- System alerts and messages
- Notification management

**Admin Dashboard**
- Patient case review and approval
- Blood request management
- Published content management
- User profile management
- Platform analytics and statistics

**Doctor Dashboard**
- Pending submission review
- Case approval/rejection workflow
- Detailed submission analysis
- Medical verification tools

**Patient Dashboard**
- Case tracking and progress monitoring
- Fundraising goal management
- Donation history
- Profile management

## Project Structure

```
Lifeline Charity Platform/
├── config/                 # Configuration files
│   └── database.js        # Database connection setup
├── controllers/           # Business logic
│   ├── authController.js
│   ├── caseController.js
│   ├── donationController.js
│   ├── bloodController.js
│   ├── doctorController.js
│   ├── adminController.js
│   ├── paymentController.js
│   ├── notificationController.js
│   └── ...
├── routes/               # API endpoints
│   ├── authRoutes.js
│   ├── caseRoutes.js
│   ├── donationRoutes.js
│   ├── bloodRoutes.js
│   ├── doctorRoutes.js
│   ├── adminRoutes.js
│   └── ...
├── middleware/           # Authentication & authorization
│   └── auth.js
├── lib/                 # Utilities
│   └── socket.js       # WebSocket configuration
├── migrations/          # Database migration scripts
│   └── 001_*.sql ... 010_*.sql
├── public/              # Frontend files
│   ├── index.html
│   ├── admin-dashboard.html
│   ├── doctor-dashboard.html
│   ├── patient-dashboard.html
│   ├── submission.html
│   ├── css/
│   ├── js/
│   └── images/
├── uploads/             # User-uploaded files
├── server.js            # Main application entry
├── package.json         # Dependencies
├── database_schema.sql  # Database setup
└── .env                 # Environment variables
```

## Prerequisites

- Node.js v14 or higher
- MySQL 5.7 or higher
- npm or yarn package manager
- Git for version control

## Installation

**1. Clone the repository**

```bash
git clone https://github.com/mdzehadulislam8/lifeline-charity-platform.git
cd "Lifeline Charity Platform"
```

**2. Install dependencies**

```bash
npm install
```

**3. Database setup**

Create a new MySQL database and import the schema:

```bash
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS charity_platform CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -u root -p charity_platform < database_schema.sql
```

Alternatively, run the migration script:

```bash
node run_migration.js
```

**4. Environment configuration**

Create a `.env` file in the project root:

```
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_DATABASE=charity_platform
DB_PORT=3306
PORT=3000
JWT_SECRET=your_jwt_secret_key_here
STRIPE_SECRET_KEY=your_stripe_secret_key
NODE_ENV=development
```

## Running the Application

**Development mode:**

```bash
npm run dev
```

**Production mode:**

```bash
npm start
```

The application will start on http://localhost:3000 (or the port specified in `.env`)

Access the API health endpoint: http://localhost:3000/api/health

## API Documentation

### Authentication Endpoints

```
POST   /api/auth/register     - User registration
POST   /api/auth/login        - User login
POST   /api/auth/logout       - User logout
GET    /api/auth/profile      - Get user profile
PUT    /api/auth/profile      - Update user profile
```

### Case Management Endpoints

```
POST   /api/cases             - Create new case
GET    /api/cases             - List all cases
GET    /api/cases/:id         - Get case details
PUT    /api/cases/:id         - Update case
DELETE /api/cases/:id         - Delete case
```

### Donation Endpoints

```
POST   /api/donations         - Create donation
GET    /api/donations         - List donations
GET    /api/donations/:id     - Get donation details
```

### Blood Management Endpoints

```
POST   /api/blood             - Create blood request
GET    /api/blood             - List blood requests
GET    /api/blood/types       - Get blood availability
```

### Doctor Endpoints (authenticated)

```
GET    /api/doctor/pending    - Get pending submissions
POST   /api/doctor/approve    - Approve submission
POST   /api/doctor/reject     - Reject submission
```

### Admin Endpoints (authenticated)

```
GET    /api/admin/cases       - List all cases for approval
POST   /api/admin/approve     - Approve case
POST   /api/admin/reject      - Reject case
GET    /api/admin/stats       - Platform statistics
```

### Payment Endpoints

```
POST   /api/payments/create   - Create payment
GET    /api/payments/history  - Get payment history
POST   /api/payments/confirm  - Confirm payment
```

## Database Schema

The platform uses a relational MySQL database with the following core entities:

**Users:** User accounts with multiple roles (patient, donor, doctor, admin)

**Patients:** Patient profiles with medical information

**Patient Cases:** Individual cases requiring financial assistance with funding goals

**Patient Submissions:** Medical case submissions with supporting documents

**Doctors:** Doctor profiles with verification status

**Donations:** Transaction records for all donations

**Payments:** Payment tracking with transaction details

**Blood Donations:** Blood donation cases and availability

**Notifications:** Real-time notification system

**Audit Logs:** System activity tracking

For detailed schema information, refer to `database_schema.sql`

## Features Workflow

**Patient Case Submission:**
1. Patient registers and creates case
2. Uploads medical documents and prescriptions
3. Doctor reviews and verifies case
4. Admin approves and publishes case
5. Donors contribute toward the goal
6. Funds are tracked and dispersed

**Blood Donation:**
1. Donor registers as blood donor
2. Selects blood type and availability
3. System matches with requests
4. Notifications sent to compatible recipients
5. Transaction completion

## Error Handling

The API implements comprehensive error handling with appropriate HTTP status codes:

- 400: Bad Request (validation errors)
- 401: Unauthorized (authentication required)
- 403: Forbidden (insufficient permissions)
- 404: Not Found (resource not found)
- 500: Internal Server Error

## Security Features

- JWT token-based authentication
- Password hashing with bcryptjs
- SQL injection prevention with parameterized queries
- CORS configuration for secure cross-origin requests
- File upload validation
- Role-based access control (RBAC)

## Testing

Create test data for development:

```bash
curl http://localhost:3000/api/test/create-sample-data
```

This endpoint generates sample patient, doctor, and case records for testing.

## Performance Considerations

- Connection pooling for database queries
- Efficient indexing on frequently queried columns
- Pagination support for large datasets
- Caching strategies for static content
- Optimized file upload handling

## Deployment

The application can be deployed using:

- Traditional Node.js hosting (DigitalOcean, Heroku, AWS EC2)
- Containerized deployment (Docker + Kubernetes)
- Serverless functions (AWS Lambda, Firebase Functions)

For production deployment:
1. Set `NODE_ENV=production`
2. Use process manager (PM2)
3. Configure environment variables securely
4. Set up SSL/TLS certificates
5. Configure database backups
6. Implement monitoring and logging

## Contributing

Contributions are welcome. Please follow these guidelines:

1. Create a feature branch
2. Make your changes
3. Write clear commit messages
4. Test your changes
5. Submit a pull request

## License

This project is licensed under the MIT License - see LICENSE file for details.

## Authors

- **Md. Zehadul Islam** - Lead Developer & Full-stack Development
- **Abdullah Al Moin** - Backend Developer & Database Architecture
- **Abu Hurayra** - Frontend Developer & UI/UX Development

**Institution:** Green University of Bangladesh

## Contact & Support

For issues, feature requests, or support:

- GitHub Issues: https://github.com/mdzehadulislam8/lifeline-charity-platform/issues
- Project Repository: https://github.com/mdzehadulislam8/lifeline-charity-platform

## Roadmap

Future enhancements planned for the platform:

- Real-time notification system with Socket.io integration
- Advanced analytics and reporting dashboard
- Mobile application (iOS & Android)
- Machine learning for fraud detection
- Integration with Bangladesh payment gateways (bKash, Nagad, Rocket)
- Multi-language support
- Video case submissions
- Community forum and discussions
- Organizer KYC and verification system
- Automated refund processing

## Acknowledgments

- Built with Node.js, Express, and MySQL
- Payment integration via Stripe
- Icons and design inspiration from modern charity platforms
- Community feedback and testing

---

**Last Updated:** May 2026

**Version:** 1.0.0
