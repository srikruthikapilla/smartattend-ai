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
    IS_PRODUCTION,
)

logger = logging.getLogger(__name__)

HTML_TEMPLATE = """\
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>{subject}</title>
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
      <h1>{header_title}</h1>
      <p>Swarna Bharathi Institute of Science and Technology (SBIT)</p>
    </div>
    <div class="body">
      <div class="greeting">Hello, <strong>{name}</strong></div>
      <div class="info">
        {info_text}
      </div>
      <div class="otp-box">
        <div class="otp-code">{otp}</div>
        <div class="expiry">Expires in 10 minutes</div>
      </div>
      <div class="info">
        {disclaimer_text}
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


def _get_port_candidates(primary_server: str, primary_port: int, primary_use_ssl: bool) -> List[Tuple[str, int, bool]]:
    """
    Returns candidate server list: [(host, port, use_ssl), ...].
    Primary port first, followed by cloud VPS fallback ports without duplicates.
    """
    primary = (primary_server, primary_port, primary_use_ssl or primary_port == 465)
    candidates = [primary]
    # Standard SMTP ports: 465 (SSL), 587 (STARTTLS), 2525 (STARTTLS)
    potential_fallbacks = [
        (primary_server, 465, True),
        (primary_server, 587, False),
        (primary_server, 2525, False),
    ]
    for fb in potential_fallbacks:
        if fb[1] != primary[1]:
            candidates.append(fb)
    return candidates


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


def send_otp_email(to_email: str, recipient_name: str, otp_code: str, purpose: str = "reset") -> bool:
    """
    Sends an OTP verification email using Brevo (Sendinblue) SMTP.
    Supports purpose="reset" (password reset) and purpose="enrollment" (student face enrollment).
    Supports port 587 (STARTTLS), port 465 (SMTPS), and port 2525 with automatic fallback
    if the cloud host blocks the primary port.
    Stops port retries immediately upon authentication or sender configuration failures.
    Returns failure without exposing verification codes in logs.
    """
    clean_email = to_email.strip().lower()

    if not BREVO_SMTP_LOGIN or not BREVO_SMTP_KEY:
        if not IS_PRODUCTION:
            logger.info(f"[Brevo SMTP: DEV MODE] ({purpose}) OTP for {clean_email}: {otp_code}")
            return True
        logger.info("[Brevo SMTP] SMTP credentials not configured; OTP delivery skipped.")
        return False

    # Validate sender email address
    sender_email = BREVO_FROM_EMAIL.strip() if BREVO_FROM_EMAIL else BREVO_SMTP_LOGIN.strip()
    from_header = f"{BREVO_FROM_NAME} <{sender_email}>" if BREVO_FROM_NAME else sender_email

    try:
        msg = EmailMessage()
        if purpose == "enrollment":
            subject = f"Smart Attend — Student Face Enrollment Verification: {otp_code}"
            header_title = "Smart Attend — Face Enrollment Verification"
            info_text = (
                "We received a request to verify your identity for first-time student face enrollment "
                "in Smart Attend AI Attendance. Use the single-use 6-digit verification code below to authorize your biometric enrollment:"
            )
            disclaimer_text = (
                "If you did not request face enrollment, please notify the SBIT campus systems administrator immediately."
            )
            plain_text = (
                f"Hello {recipient_name or 'Student'},\n\n"
                f"Your Smart Attend student face enrollment verification code is: {otp_code}\n\n"
                f"This code will expire in 10 minutes.\n"
                f"If you did not request enrollment, please notify the SBIT campus systems administrator.\n\n"
                f"Smart Attend AI — SBIT Campus"
            )
        else:
            subject = f"Smart Attend — Your Verification Code: {otp_code}"
            header_title = "Smart Attend — AI Attendance System"
            info_text = (
                "We received a request to reset your institutional account password. "
                "Use the single-use 6-digit verification code below to authorize the update:"
            )
            disclaimer_text = (
                "If you did not request a password reset, please disregard this email or notify the SBIT campus systems administrator immediately."
            )
            plain_text = (
                f"Hello {recipient_name or 'Faculty / Administrator'},\n\n"
                f"Your Smart Attend password reset code is: {otp_code}\n\n"
                f"This code will expire in 10 minutes.\n"
                f"If you did not request a password reset, please disregard this email or notify the SBIT campus systems administrator immediately.\n\n"
                f"Smart Attend AI — SBIT Campus"
            )

        msg["Subject"] = subject
        msg["From"] = from_header
        msg["To"] = clean_email
        msg["Sender"] = sender_email
        msg["Reply-To"] = sender_email
        msg.set_content(plain_text)

        html_content = HTML_TEMPLATE.format(
            subject=subject,
            header_title=header_title,
            name=recipient_name or ("Student" if purpose == "enrollment" else "Faculty / Administrator"),
            info_text=info_text,
            otp=otp_code,
            disclaimer_text=disclaimer_text
        )
        msg.add_alternative(html_content, subtype="html")

        # Candidate server and ports to attempt (primary first, then cloud VPS fallbacks)
        primary_use_ssl = BREVO_SMTP_USE_SSL or (BREVO_SMTP_PORT == 465)
        candidates = _get_port_candidates(BREVO_SMTP_SERVER, BREVO_SMTP_PORT, primary_use_ssl)

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
                    f"[Brevo SMTP] Successfully dispatched {purpose} OTP to {clean_email} "
                    f"via {srv}:{prt} ({'SSL' if ssl_mode else 'STARTTLS'})"
                )
                return True
            except smtplib.SMTPAuthenticationError as auth_err:
                logger.error(
                    f"[Brevo SMTP] Authentication failed (535): {auth_err}. "
                    f"Please verify BREVO_SMTP_LOGIN ('{BREVO_SMTP_LOGIN}') and BREVO_SMTP_KEY in Coolify / .env. "
                    "In Brevo, generate an 'SMTP Key' under SMTP & API > SMTP Keys (do NOT use an API v3 key)."
                )
                last_error = auth_err
                break  # Permanent credential error: do not retry other ports
            except smtplib.SMTPSenderRefused as sender_err:
                logger.error(
                    f"[Brevo SMTP] Sender address refused: {sender_err}. "
                    f"Sender '{sender_email}' is not authorized. In Brevo, verify this email under Senders & IPs > Senders."
                )
                last_error = sender_err
                break  # Permanent sender configuration error: do not retry other ports
            except smtplib.SMTPRecipientsRefused as recip_err:
                logger.error(
                    f"[Brevo SMTP] Recipient address refused ({clean_email}): {recip_err}."
                )
                last_error = recip_err
                break  # Permanent recipient error: do not retry other ports
            except smtplib.SMTPDataError as data_err:
                logger.error(
                    f"[Brevo SMTP] Message rejected by server: {data_err}."
                )
                last_error = data_err
                break  # Permanent message error: do not retry other ports
            except smtplib.SMTPResponseException as resp_err:
                if resp_err.smtp_code in (534, 535):
                    logger.error(f"[Brevo SMTP] Authentication rejected (535): {resp_err}.")
                    last_error = resp_err
                    break  # Permanent auth error
                elif resp_err.smtp_code in (550, 551, 552, 553, 554):
                    logger.error(f"[Brevo SMTP] Sender/relay policy rejected ({resp_err.smtp_code}): {resp_err}.")
                    last_error = resp_err
                    break  # Permanent sender/relay policy error
                logger.error(f"[Brevo SMTP] SMTP response error on {srv}:{prt}: {resp_err}")
                last_error = resp_err
                continue
            except (socket.timeout, TimeoutError, ConnectionRefusedError, socket.gaierror, OSError) as net_err:
                logger.warning(
                    f"[Brevo SMTP] Connection to {srv}:{prt} failed ({net_err}). "
                    "Cloud VPS host may block this outbound port. Trying fallback port..."
                )
                last_error = net_err
                continue
            except Exception as other_err:
                logger.error(f"[Brevo SMTP] Delivery error on {srv}:{prt}: {other_err}")
                last_error = other_err
                continue

        logger.error(f"[Brevo SMTP] Failed to send email to {clean_email} across all ports: {last_error}")
        logger.warning("[Brevo SMTP Fallback] OTP delivery failed; code withheld from logs.")
        return False

    except Exception as e:
        logger.error(f"[Brevo SMTP] Unexpected error preparing email for {clean_email}: {e}")
        logger.warning("[Brevo SMTP Fallback] OTP delivery failed; code withheld from logs.")
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
    If primary port encounters a network timeout or connection refused (common on VPS hosts),
    it tests fallback ports (465 SSL, 587 STARTTLS, 2525) to diagnose and identify a working port.
    Provides actionable diagnostics for Coolify environments.
    """
    if not BREVO_SMTP_LOGIN or not BREVO_SMTP_KEY:
        return {
            "success": False,
            "configured": False,
            "stage": "configuration",
            "message": "Brevo SMTP credentials are not configured. Set BREVO_SMTP_LOGIN and BREVO_SMTP_KEY in Coolify / .env.",
            "status": get_smtp_status()
        }

    sender_email = BREVO_FROM_EMAIL.strip() if BREVO_FROM_EMAIL else BREVO_SMTP_LOGIN.strip()
    primary_use_ssl = BREVO_SMTP_USE_SSL or (BREVO_SMTP_PORT == 465)
    candidates = _get_port_candidates(BREVO_SMTP_SERVER, BREVO_SMTP_PORT, primary_use_ssl)

    ctx = ssl.create_default_context()
    last_error_info: Dict[str, Any] = {}
    tested_ports: List[int] = []

    for srv, prt, ssl_mode in candidates:
        tested_ports.append(prt)
        server = None
        try:
            if ssl_mode or prt == 465:
                server = smtplib.SMTP_SSL(srv, prt, timeout=6, context=ctx)
            else:
                server = smtplib.SMTP(srv, prt, timeout=6)
                server.ehlo()
                server.starttls(context=ctx)
                server.ehlo()

            server.login(BREVO_SMTP_LOGIN, BREVO_SMTP_KEY)

            # If a recipient email is provided, send a verification test message
            test_sent = False
            if test_recipient:
                clean_recip = test_recipient.strip().lower()
                msg = EmailMessage()
                msg["Subject"] = "Smart Attend — SMTP Configuration Test"
                msg["From"] = f"{BREVO_FROM_NAME} <{sender_email}>"
                msg["To"] = clean_recip
                msg["Sender"] = sender_email
                msg["Reply-To"] = sender_email
                msg.set_content(
                    f"Hello!\n\nThis is a test email confirming that Brevo SMTP is successfully configured "
                    f"on your Smart Attend instance ({srv}:{prt}).\n\n"
                    f"Smart Attend AI — SBIT Campus"
                )
                server.send_message(msg)
                test_sent = True

            try:
                server.quit()
            except Exception:
                pass

            is_fallback = (prt != BREVO_SMTP_PORT)
            success_msg = (
                f"SMTP connection, authentication, and {'test email delivery' if test_sent else 'handshake'} "
                f"successful on port {prt} ({'SSL' if ssl_mode else 'STARTTLS'})!"
            )
            if is_fallback:
                success_msg += (
                    f" (Note: Configured port {BREVO_SMTP_PORT} was unreachable; port {prt} succeeded. "
                    f"Recommended: Set BREVO_SMTP_PORT={prt} and BREVO_SMTP_USE_SSL={'true' if ssl_mode else 'false'} in Coolify / .env)."
                )

            return {
                "success": True,
                "configured": True,
                "stage": "completed",
                "server": srv,
                "port": prt,
                "ssl": ssl_mode,
                "is_fallback_port": is_fallback,
                "tested_ports": tested_ports,
                "test_email_sent": test_sent,
                "message": success_msg
            }

        except smtplib.SMTPAuthenticationError as auth_err:
            if server:
                try: server.close()
                except Exception: pass
            return {
                "success": False,
                "configured": True,
                "stage": "authentication",
                "server": srv,
                "port": prt,
                "tested_ports": tested_ports,
                "error": str(auth_err),
                "message": (
                    "Brevo authentication failed (535). Ensure BREVO_SMTP_LOGIN is your Brevo login email "
                    "and BREVO_SMTP_KEY is an SMTP Key generated from Brevo Dashboard > SMTP & API > SMTP Keys "
                    "(do NOT use an API v3 key)."
                )
            }
        except smtplib.SMTPSenderRefused as sender_err:
            if server:
                try: server.close()
                except Exception: pass
            return {
                "success": False,
                "configured": True,
                "stage": "sender_verification",
                "server": srv,
                "port": prt,
                "tested_ports": tested_ports,
                "error": str(sender_err),
                "message": (
                    f"Brevo rejected the 'From' address. The email '{sender_email}' "
                    "must be added and verified in Brevo Dashboard > Senders & IPs > Senders."
                )
            }
        except smtplib.SMTPResponseException as resp_err:
            if server:
                try: server.close()
                except Exception: pass
            if resp_err.smtp_code in (534, 535):
                return {
                    "success": False,
                    "configured": True,
                    "stage": "authentication",
                    "server": srv,
                    "port": prt,
                    "tested_ports": tested_ports,
                    "error": str(resp_err),
                    "message": "Brevo authentication rejected (535). Check your Brevo SMTP login and key."
                }
            elif resp_err.smtp_code in (550, 551, 552, 553, 554):
                return {
                    "success": False,
                    "configured": True,
                    "stage": "sender_verification",
                    "server": srv,
                    "port": prt,
                    "tested_ports": tested_ports,
                    "error": str(resp_err),
                    "message": f"Sender or relaying rejected ({resp_err.smtp_code}): {resp_err.smtp_error.decode() if isinstance(resp_err.smtp_error, bytes) else resp_err.smtp_error}."
                }
            last_error_info = {
                "stage": "smtp_error",
                "error": str(resp_err),
                "message": f"SMTP response error on port {prt}: {resp_err}"
            }
        except (socket.timeout, TimeoutError, ConnectionRefusedError, socket.gaierror, OSError) as net_err:
            if server:
                try: server.close()
                except Exception: pass
            logger.warning(f"[Brevo SMTP Test] Port {prt} connection failed: {net_err}. Trying fallback port...")
            last_error_info = {
                "stage": "connection_timeout",
                "error": str(net_err),
                "message": (
                    f"Connection to {srv}:{prt} timed out or was refused. "
                    "Cloud hosting providers often block port 587. "
                    "Fix: Set BREVO_SMTP_PORT=465 and BREVO_SMTP_USE_SSL=true in Coolify / .env."
                )
            }
            continue
        except Exception as exc:
            if server:
                try: server.close()
                except Exception: pass
            logger.error(f"[Brevo SMTP Test] Unexpected error on port {prt}: {exc}")
            last_error_info = {
                "stage": "smtp_error",
                "error": str(exc),
                "message": f"SMTP test encountered an unexpected error on port {prt}: {exc}"
            }

    # All candidate ports failed
    return {
        "success": False,
        "configured": True,
        "stage": last_error_info.get("stage", "connection_timeout"),
        "server": BREVO_SMTP_SERVER,
        "port": BREVO_SMTP_PORT,
        "tested_ports": tested_ports,
        "error": last_error_info.get("error", "All candidate ports failed to connect"),
        "message": last_error_info.get("message", f"Failed to connect to {BREVO_SMTP_SERVER} across ports {tested_ports}.")
    }
