import ssl
import socket
import smtplib
import logging
from email.message import EmailMessage
from typing import Optional, Dict, Any, List, Tuple

from app.config import (
    BREVO_SMTP_SERVER,
    BREVO_SMTP_PORT,
    BREVO_SMTP_LOGIN,
    BREVO_SMTP_KEY,
    BREVO_FROM_EMAIL,
    BREVO_FROM_NAME,
    BREVO_SMTP_USE_SSL,
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

def _dispatch_smtp_message(
    server_host: str,
    port: int,
    use_ssl: bool,
    login: str,
    key: str,
    msg: EmailMessage,
    timeout: int = 7
) -> None:
    """Internal helper to dispatch message with appropriate TLS/SSL mode."""
    ctx = ssl.create_default_context()
    if use_ssl or port == 465:
        with smtplib.SMTP_SSL(server_host, port, timeout=timeout, context=ctx) as server:
            server.login(login, key)
            server.send_message(msg)
    else:
        with smtplib.SMTP(server_host, port, timeout=timeout) as server:
            server.ehlo()
            server.starttls(context=ctx)
            server.ehlo()
            server.login(login, key)
            server.send_message(msg)


def send_otp_email(to_email: str, recipient_name: str, otp_code: str) -> bool:
    """
    Sends an OTP verification email using Brevo (Sendinblue) SMTP.
    Supports port 587 (STARTTLS) and port 465 (SMTPS), with automatic fallback
    to alternative ports if the cloud host blocks the primary port.
    Gracefully logs OTP in container logs so administrators/users are never locked out.
    """
    clean_email = to_email.strip().lower()

    if not BREVO_SMTP_LOGIN or not BREVO_SMTP_KEY:
        logger.info(
            f"[Brevo SMTP: DEV MODE] Brevo credentials not configured. "
            f"OTP for {clean_email} ({recipient_name}): {otp_code}"
        )
        return True

    # Validate sender email address
    sender_email = BREVO_FROM_EMAIL.strip() if BREVO_FROM_EMAIL else BREVO_SMTP_LOGIN.strip()
    from_header = f"{BREVO_FROM_NAME} <{sender_email}>" if BREVO_FROM_NAME else sender_email

    try:
        msg = EmailMessage()
        msg["Subject"] = f"Smart Attend — Your Verification Code: {otp_code}"
        msg["From"] = from_header
        msg["To"] = clean_email
        msg["Sender"] = sender_email
        msg["Reply-To"] = sender_email

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

        # Candidate server and ports to attempt (primary first, then cloud VPS fallbacks)
        primary_use_ssl = BREVO_SMTP_USE_SSL or (BREVO_SMTP_PORT == 465)
        candidates: List[Tuple[str, int, bool]] = [
            (BREVO_SMTP_SERVER, BREVO_SMTP_PORT, primary_use_ssl)
        ]

        # If primary port is 587 (often blocked on VPS like Hetzner/DigitalOcean/Coolify),
        # add port 465 (SSL) and port 2525 (STARTTLS) as auto-fallbacks
        if BREVO_SMTP_PORT == 587:
            candidates.append((BREVO_SMTP_SERVER, 465, True))
            candidates.append((BREVO_SMTP_SERVER, 2525, False))
        elif BREVO_SMTP_PORT == 465:
            candidates.append((BREVO_SMTP_SERVER, 587, False))
            candidates.append((BREVO_SMTP_SERVER, 2525, False))

        last_error = None
        for srv, prt, ssl_mode in candidates:
            try:
                _dispatch_smtp_message(
                    server_host=srv,
                    port=prt,
                    use_ssl=ssl_mode,
                    login=BREVO_SMTP_LOGIN,
                    key=BREVO_SMTP_KEY,
                    msg=msg,
                    timeout=7
                )
                logger.info(
                    f"[Brevo SMTP] Successfully dispatched password reset OTP to {clean_email} "
                    f"via {srv}:{prt} ({'SSL' if ssl_mode else 'STARTTLS'})"
                )
                return True
            except (socket.timeout, TimeoutError, ConnectionRefusedError, OSError) as net_err:
                logger.warning(
                    f"[Brevo SMTP] Connection to {srv}:{prt} failed ({net_err}). "
                    "Cloud VPS host may block this outbound port. Trying fallback port..."
                )
                last_error = net_err
                continue
            except smtplib.SMTPAuthenticationError as auth_err:
                logger.error(
                    f"[Brevo SMTP] Authentication failed (535): {auth_err}. "
                    f"Please verify BREVO_SMTP_LOGIN ('{BREVO_SMTP_LOGIN}') and BREVO_SMTP_KEY in Coolify. "
                    "In Brevo, generate an 'SMTP Key' under SMTP & API > SMTP Keys (do NOT use an API v3 key)."
                )
                last_error = auth_err
                break  # Don't retry other ports on bad credentials
            except smtplib.SMTPSenderRefused as sender_err:
                logger.error(
                    f"[Brevo SMTP] Sender address refused: {sender_err}. "
                    f"Sender '{sender_email}' is not authorized. In Brevo, verify this email under Senders & IPs > Senders."
                )
                last_error = sender_err
                break
            except Exception as other_err:
                logger.error(f"[Brevo SMTP] Delivery error on {srv}:{prt}: {other_err}")
                last_error = other_err
                continue

        logger.error(f"[Brevo SMTP] Failed to send email to {clean_email} across all ports: {last_error}")
        # Always log OTP in server logs so administrators and users are never locked out
        logger.warning(f"[Brevo SMTP Fallback] OTP for {clean_email}: {otp_code}")
        return False

    except Exception as e:
        logger.error(f"[Brevo SMTP] Unexpected error preparing email for {clean_email}: {e}")
        logger.warning(f"[Brevo SMTP Fallback] OTP for {clean_email}: {otp_code}")
        return False


def get_smtp_status() -> Dict[str, Any]:
    """Return sanitized SMTP configuration status for health checks."""
    configured = bool(BREVO_SMTP_LOGIN and BREVO_SMTP_KEY)
    sender = BREVO_FROM_EMAIL.strip() if BREVO_FROM_EMAIL else BREVO_SMTP_LOGIN.strip()
    return {
        "configured": configured,
        "mode": "live" if configured else "development_log_only",
        "server": BREVO_SMTP_SERVER,
        "port": BREVO_SMTP_PORT,
        "use_ssl": BREVO_SMTP_USE_SSL or (BREVO_SMTP_PORT == 465),
        "from_email": sender or "not_set",
        "from_name": BREVO_FROM_NAME,
        "login_provided": bool(BREVO_SMTP_LOGIN),
        "key_provided": bool(BREVO_SMTP_KEY)
    }


def test_smtp_connection(test_recipient: Optional[str] = None) -> Dict[str, Any]:
    """
    Directly test SMTP connectivity, SSL/STARTTLS handshake, and login against Brevo.
    Optionally send a test email to `test_recipient`.
    Provides actionable diagnostics for Coolify environments.
    """
    if not BREVO_SMTP_LOGIN or not BREVO_SMTP_KEY:
        return {
            "success": False,
            "configured": False,
            "stage": "configuration",
            "message": "Brevo SMTP credentials are not configured. Set BREVO_SMTP_LOGIN and BREVO_SMTP_KEY in Coolify.",
            "status": get_smtp_status()
        }

    use_ssl = BREVO_SMTP_USE_SSL or (BREVO_SMTP_PORT == 465)
    ctx = ssl.create_default_context()
    connected_port = BREVO_SMTP_PORT

    try:
        if use_ssl:
            server = smtplib.SMTP_SSL(BREVO_SMTP_SERVER, BREVO_SMTP_PORT, timeout=8, context=ctx)
        else:
            server = smtplib.SMTP(BREVO_SMTP_SERVER, BREVO_SMTP_PORT, timeout=8)
            server.ehlo()
            server.starttls(context=ctx)
            server.ehlo()

        server.login(BREVO_SMTP_LOGIN, BREVO_SMTP_KEY)

        # If a recipient email is provided, send a verification test message
        test_sent = False
        if test_recipient:
            clean_recip = test_recipient.strip().lower()
            sender_email = BREVO_FROM_EMAIL.strip() if BREVO_FROM_EMAIL else BREVO_SMTP_LOGIN.strip()
            msg = EmailMessage()
            msg["Subject"] = "Smart Attend — SMTP Configuration Test"
            msg["From"] = f"{BREVO_FROM_NAME} <{sender_email}>"
            msg["To"] = clean_recip
            msg.set_content(
                f"Hello!\n\nThis is a test email confirming that Brevo SMTP is successfully configured "
                f"on your Smart Attend instance ({BREVO_SMTP_SERVER}:{connected_port}).\n\n"
                f"Smart Attend AI — SBIT Campus"
            )
            server.send_message(msg)
            test_sent = True

        server.quit()

        return {
            "success": True,
            "configured": True,
            "stage": "completed",
            "server": BREVO_SMTP_SERVER,
            "port": connected_port,
            "ssl": use_ssl,
            "test_email_sent": test_sent,
            "message": (
                f"SMTP connection, authentication, and {'test email delivery' if test_sent else 'handshake'} successful!"
            )
        }

    except (socket.timeout, TimeoutError, ConnectionRefusedError, OSError) as net_err:
        return {
            "success": False,
            "configured": True,
            "stage": "connection_timeout",
            "server": BREVO_SMTP_SERVER,
            "port": BREVO_SMTP_PORT,
            "error": str(net_err),
            "message": (
                f"Connection to {BREVO_SMTP_SERVER}:{BREVO_SMTP_PORT} timed out or was refused. "
                "Cloud hosting providers (like Hetzner, DigitalOcean, AWS where Coolify runs) often block port 587. "
                "Fix: Set BREVO_SMTP_PORT=465 and BREVO_SMTP_USE_SSL=true in Coolify."
            )
        }
    except smtplib.SMTPAuthenticationError as auth_err:
        return {
            "success": False,
            "configured": True,
            "stage": "authentication",
            "server": BREVO_SMTP_SERVER,
            "port": BREVO_SMTP_PORT,
            "error": str(auth_err),
            "message": (
                "Brevo authentication failed (535). Ensure BREVO_SMTP_LOGIN is your Brevo login email "
                "and BREVO_SMTP_KEY is an SMTP Key generated from Brevo Dashboard > SMTP & API > SMTP Keys "
                "(do NOT use an API v3 key)."
            )
        }
    except smtplib.SMTPSenderRefused as sender_err:
        return {
            "success": False,
            "configured": True,
            "stage": "sender_verification",
            "server": BREVO_SMTP_SERVER,
            "port": BREVO_SMTP_PORT,
            "error": str(sender_err),
            "message": (
                f"Brevo rejected the 'From' address. The email '{BREVO_FROM_EMAIL or BREVO_SMTP_LOGIN}' "
                "must be added and verified in Brevo Dashboard > Senders & IPs > Senders."
            )
        }
    except Exception as exc:
        return {
            "success": False,
            "configured": True,
            "stage": "smtp_error",
            "server": BREVO_SMTP_SERVER,
            "port": BREVO_SMTP_PORT,
            "error": str(exc),
            "message": f"SMTP test encountered an error: {exc}"
        }

