import smtplib
import logging
from email.message import EmailMessage
from typing import Optional

from app.config import (
    BREVO_SMTP_SERVER,
    BREVO_SMTP_PORT,
    BREVO_SMTP_LOGIN,
    BREVO_SMTP_KEY,
    BREVO_FROM_EMAIL,
    BREVO_FROM_NAME,
)

logger = logging.getLogger(__name__)

HTML_TEMPLATE = """\
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Smart Attend — Password Reset</title>
  <style>
    body {{
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #0f172a;
      margin: 0;
      padding: 24px;
      color: #1e293b;
    }}
    .container {{
      max-width: 520px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
    }}
    .header {{
      background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);
      padding: 32px 24px;
      text-align: center;
      color: #ffffff;
    }}
    .header h1 {{
      margin: 0 0 6px 0;
      font-size: 20px;
      font-weight: 700;
      letter-spacing: -0.5px;
    }}
    .header p {{
      margin: 0;
      font-size: 12px;
      opacity: 0.9;
    }}
    .body {{
      padding: 32px 28px;
    }}
    .greeting {{
      font-size: 15px;
      color: #334155;
      margin-bottom: 16px;
    }}
    .info {{
      font-size: 14px;
      color: #64748b;
      line-height: 1.6;
      margin-bottom: 24px;
    }}
    .otp-box {{
      background-color: #f8fafc;
      border: 2px dashed #93c5fd;
      border-radius: 12px;
      padding: 20px;
      text-align: center;
      margin: 24px 0;
    }}
    .otp-code {{
      font-family: 'Courier New', Courier, monospace;
      font-size: 34px;
      font-weight: 800;
      letter-spacing: 8px;
      color: #1d4ed8;
      margin: 0;
    }}
    .expiry {{
      font-size: 12px;
      color: #dc2626;
      font-weight: 600;
      margin-top: 8px;
    }}
    .footer {{
      background-color: #f1f5f9;
      padding: 20px 24px;
      text-align: center;
      font-size: 11px;
      color: #64748b;
      border-top: 1px solid #e2e8f0;
    }}
    .footer p {{
      margin: 4px 0;
    }}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Smart Attend — AI Attendance System</h1>
      <p>Swarna Bharathi Institute of Science and Technology (SBIT)</p>
    </div>
    <div class="body">
      <div class="greeting">Hello, <strong>{name}</strong></div>
      <div class="info">
        We received a request to reset your institutional account password. Use the single-use 6-digit verification code below to authorize the update:
      </div>
      <div class="otp-box">
        <div class="otp-code">{otp}</div>
        <div class="expiry">Expires in 10 minutes</div>
      </div>
      <div class="info">
        If you did not request a password reset, please disregard this email or notify the SBIT campus systems administrator immediately.
      </div>
    </div>
    <div class="footer">
      <p>Smart Attend AI Portal &bull; SBIT Campus &bull; Khammam, Telangana</p>
      <p>This is an automated system email. Please do not reply directly.</p>
    </div>
  </div>
</body>
</html>
"""

def send_otp_email(to_email: str, recipient_name: str, otp_code: str) -> bool:
    """
    Sends an OTP verification email using Brevo (Sendinblue) SMTP.
    Gracefully logs OTP if Brevo SMTP credentials are not yet configured.
    """
    clean_email = to_email.strip().lower()

    if not BREVO_SMTP_LOGIN or not BREVO_SMTP_KEY:
        logger.info(
            f"[Brevo SMTP: DEV MODE] Brevo credentials not configured. "
            f"OTP for {clean_email} ({recipient_name}): {otp_code}"
        )
        return True

    try:
        msg = EmailMessage()
        msg["Subject"] = f"Smart Attend — Your Verification Code: {otp_code}"
        from_sender = f"{BREVO_FROM_NAME} <{BREVO_FROM_EMAIL}>" if BREVO_FROM_EMAIL else BREVO_SMTP_LOGIN
        msg["From"] = from_sender
        msg["To"] = clean_email

        plain_text = (
            f"Hello {recipient_name},\n\n"
            f"Your Smart Attend password reset code is: {otp_code}\n\n"
            f"This code will expire in 10 minutes.\n"
            f"If you did not request this, please ignore this email.\n\n"
            f"Smart Attend AI — SBIT Campus"
        )
        msg.set_content(plain_text)

        html_content = HTML_TEMPLATE.format(
            name=recipient_name or "Faculty / Administrator",
            otp=otp_code
        )
        msg.add_alternative(html_content, subtype="html")

        # Connect to Brevo SMTP
        with smtplib.SMTP(BREVO_SMTP_SERVER, BREVO_SMTP_PORT, timeout=10) as server:
            server.starttls()
            server.login(BREVO_SMTP_LOGIN, BREVO_SMTP_KEY)
            server.send_message(msg)

        logger.info(f"[Brevo SMTP] Dispatched password reset OTP to {clean_email}")
        return True
    except Exception as e:
        logger.error(f"[Brevo SMTP] Failed to send email to {clean_email}: {e}")
        # Always log OTP in server logs so administrators are never locked out
        logger.warning(f"[Brevo SMTP Fallback] OTP for {clean_email}: {otp_code}")
        return False
