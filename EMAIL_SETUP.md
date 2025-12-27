# Email Setup Guide

## Newsletter Subscription Email

The newsletter subscription now sends a confirmation email when someone subscribes.

## Configuration

### Development (No SMTP Required)
In development, emails are logged to the console only. No configuration needed.

### Production (SMTP Required)
Set these environment variables to send real emails:

```bash
SMTP_HOST=smtp.gmail.com          # Your SMTP server
SMTP_PORT=587                     # SMTP port (587 for TLS, 465 for SSL)
SMTP_USER=your-email@gmail.com    # SMTP username
SMTP_PASSWORD=your-app-password   # SMTP password or app password
SMTP_FROM=noreply@subkiller.com   # From email address (optional)
```

### Example: Gmail SMTP
```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-gmail-app-password  # Generate in Google Account settings
SMTP_FROM=SubKiller <noreply@subkiller.com>
```

### Example: SendGrid
```bash
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=your-sendgrid-api-key
SMTP_FROM=noreply@subkiller.com
```

### Example: AWS SES
```bash
SMTP_HOST=email-smtp.us-east-1.amazonaws.com
SMTP_PORT=587
SMTP_USER=your-ses-smtp-username
SMTP_PASSWORD=your-ses-smtp-password
SMTP_FROM=noreply@subkiller.com
```

## Testing

1. **Without SMTP (Development)**:
   - Subscribe via the newsletter modal
   - Check server logs - you'll see: `[email] Mock email sent: { to: '...', subject: '...' }`
   - Subscription is saved to database

2. **With SMTP (Production)**:
   - Set environment variables
   - Subscribe via the newsletter modal
   - Check server logs - you'll see: `[email] Newsletter confirmation sent: { to: '...', messageId: '...' }`
   - User receives confirmation email

## Troubleshooting

### Email not sending
- Check SMTP credentials are correct
- Check SMTP_HOST and SMTP_PORT
- For Gmail: Use an "App Password" (not your regular password)
- Check server logs for error messages

### Backend not reachable
- Ensure backend server is running: `npm run dev:server`
- Check backend is on port 4000 (or PORT env var)
- Check CORS allows your frontend origin

