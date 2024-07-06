require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const path = require('path');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const { v4: uuidv4 } = require('uuid');

const app = express();

// Rate Limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests, please try again later.'
});

app.use(limiter);
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Middleware to set CSP with nonce
app.use((req, res, next) => {
    const nonce = uuidv4(); // Generate a unique nonce for each request
    res.locals.nonce = nonce;
    helmet({
        contentSecurityPolicy: {
            useDefaults: true,
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'", `'nonce-${nonce}'`, "https://maps.googleapis.com"],
                styleSrc: ["'self'", "https://fonts.googleapis.com", "https://maps.googleapis.com"],
                imgSrc: ["'self'", "data:", "https://maps.googleapis.com"],
                frameSrc: ["'self'", "https://www.google.com"],
                connectSrc: ["'self'", "https://maps.googleapis.com"],
                upgradeInsecureRequests: []
            }
        },
        referrerPolicy: { policy: "no-referrer-when-downgrade" }
    })(req, res, next);
});

// Validate input function
const validateInput = (name, email, phone, message) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^\+?[1-9]\d{1,14}$/; // Simple phone validation
    return (
        name && typeof name === 'string' && name.trim() !== '' &&
        email && emailRegex.test(email) &&
        phone && phoneRegex.test(phone) &&
        message && typeof message === 'string' && message.trim() !== ''
    );
};

app.post('/send-email', (req, res) => {
    const { name, email, phone, message } = req.body;

    if (!validateInput(name, email, phone, message)) {
        return res.status(400).send(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Email Status</title>
            </head>
            <body>
                <p>Invalid input data</p>
                <p>Redirecting to the homepage in 5 seconds...</p>
                <script nonce="${res.locals.nonce}">
                    setTimeout(function() {
                        window.location.href = '/';
                    }, 5000);
                </script>
            </body>
            </html>
        `);
    }

    if (!process.env.YAHOO_EMAIL || !process.env.YAHOO_PASSWORD || !process.env.RECIPIENT_EMAIL) {
        return res.status(500).send(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Email Status</title>
            </head>
            <body>
                <p>Email configuration is missing.</p>
                <p>Redirecting to the homepage in 5 seconds...</p>
                <script nonce="${res.locals.nonce}">
                    setTimeout(function() {
                        window.location.href = '/';
                    }, 5000);
                </script>
            </body>
            </html>
        `);
    }

    const transporter = nodemailer.createTransport({
        host: 'smtp.mail.yahoo.com',
        port: 465,
        secure: true, // true for 465, false for other ports
        auth: {
            user: process.env.YAHOO_EMAIL,
            pass: process.env.YAHOO_PASSWORD // Use the app-specific password you generated
        }
    });

    const mailOptions = {
        from: process.env.YAHOO_EMAIL, // sender address
        to: process.env.RECIPIENT_EMAIL, // recipient address
        subject: 'Contact Us Form Submission', // Subject line
        text: `Name: ${name}\nEmail: ${email}\nPhone: ${phone}\nMessage: ${message}` // plain text body
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.error('Error occurred: ', error.message);
            if (error.response) {
                console.error('Response received: ', error.response);
            }
            return res.status(500).send(`
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Email Status</title>
                </head>
                <body>
                    <p>Failed to send email: ${error.message}</p>
                    <p>Redirecting to the homepage in 5 seconds...</p>
                    <script nonce="${res.locals.nonce}">
                        setTimeout(function() {
                            window.location.href = '/';
                        }, 5000);
                    </script>
                </body>
                </html>
            `);
        }
        res.status(200).send(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Email Status</title>
            </head>
            <body>
                <p>Email sent successfully.</p>
                <p>Redirecting to the homepage in 5 seconds...</p>
                <script nonce="${res.locals.nonce}">
                    setTimeout(function() {
                        window.location.href = '/';
                    }, 5000);
                </script>
            </body>
            </html>
        `);
    });
});

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});