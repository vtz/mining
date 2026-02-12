"""Email service for viability alerts.

Uses Resend for email delivery. Falls back gracefully if not configured.
"""

import logging
from typing import Optional

from app.config import get_settings

logger = logging.getLogger(__name__)

# Lazy import resend to avoid hard dependency
_resend = None


def _get_resend():
    global _resend
    if _resend is None:
        try:
            import resend as _resend_module

            _resend = _resend_module
        except ImportError:
            logger.warning("resend package not installed. Email alerts disabled.")
            return None
    return _resend


def is_email_configured() -> bool:
    """Check if email sending is configured."""
    settings = get_settings()
    return bool(settings.resend_api_key)


def send_viability_alert(
    recipient_email: str,
    scenario_name: str,
    mine_name: str,
    area_name: str,
    target_variable: str,
    target_nsr: float,
    current_nsr: float,
    threshold_value: float,
    current_prices: dict,
) -> bool:
    """
    Send a viability alert email.

    Args:
        recipient_email: Email address to send to.
        scenario_name: Name of the scenario.
        mine_name: Mine name.
        area_name: Area name.
        target_variable: Variable being tracked.
        target_nsr: Target NSR value.
        current_nsr: Current computed NSR.
        threshold_value: The threshold value set in goal seek.
        current_prices: Dict with cu_price, au_price, ag_price.

    Returns:
        True if email was sent successfully, False otherwise.
    """
    resend = _get_resend()
    if resend is None:
        logger.warning("Resend not available, skipping email.")
        return False

    settings = get_settings()
    if not settings.resend_api_key:
        logger.warning("RESEND_API_KEY not set, skipping email.")
        return False

    resend.api_key = settings.resend_api_key

    cu_price = current_prices.get("cu_price", 0)
    au_price = current_prices.get("au_price", 0)
    ag_price = current_prices.get("ag_price", 0)

    viable_text = "VIABLE" if current_nsr >= target_nsr else "NOT VIABLE"
    viable_color = "#16a34a" if current_nsr >= target_nsr else "#dc2626"

    html_body = f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #3b82f6, #10b981); padding: 24px; border-radius: 12px 12px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 20px;">NSR Viability Alert</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0;">Scenario: {scenario_name}</p>
        </div>
        
        <div style="background: #ffffff; padding: 24px; border: 1px solid #e5e7eb; border-top: none;">
            <div style="text-align: center; padding: 16px; background: #f9fafb; border-radius: 8px; margin-bottom: 20px;">
                <p style="color: #6b7280; margin: 0 0 4px; font-size: 14px;">Current NSR</p>
                <p style="font-size: 32px; font-weight: bold; margin: 0; color: {viable_color};">
                    ${current_nsr:.2f}/t
                </p>
                <p style="color: {viable_color}; font-weight: 600; margin: 4px 0 0;">{viable_text}</p>
            </div>
            
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                <tr>
                    <td style="padding: 8px 0; color: #6b7280;">Mine / Area</td>
                    <td style="padding: 8px 0; text-align: right; font-weight: 500;">{mine_name} / {area_name}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; color: #6b7280;">Target Variable</td>
                    <td style="padding: 8px 0; text-align: right; font-weight: 500;">{target_variable}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; color: #6b7280;">Target NSR</td>
                    <td style="padding: 8px 0; text-align: right; font-weight: 500;">${target_nsr:.2f}/t</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; color: #6b7280;">Threshold Set</td>
                    <td style="padding: 8px 0; text-align: right; font-weight: 500;">{threshold_value:.4f}</td>
                </tr>
            </table>
            
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 16px 0;">
            
            <p style="font-size: 14px; color: #6b7280; margin-bottom: 8px;">Current Metal Prices</p>
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                <tr>
                    <td style="padding: 4px 0;">Cu</td>
                    <td style="text-align: right; font-weight: 500;">${cu_price:.2f}/lb</td>
                </tr>
                <tr>
                    <td style="padding: 4px 0;">Au</td>
                    <td style="text-align: right; font-weight: 500;">${au_price:.0f}/oz</td>
                </tr>
                <tr>
                    <td style="padding: 4px 0;">Ag</td>
                    <td style="text-align: right; font-weight: 500;">${ag_price:.2f}/oz</td>
                </tr>
            </table>
        </div>
        
        <div style="padding: 16px; text-align: center; color: #9ca3af; font-size: 12px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
            NSR Calculator — Automated viability alert
        </div>
    </div>
    """

    try:
        resend.Emails.send(
            {
                "from": settings.alert_from_email,
                "to": [recipient_email],
                "subject": f"NSR Alert: {scenario_name} — {viable_text} (${current_nsr:.2f}/t)",
                "html": html_body,
            }
        )
        logger.info(f"Viability alert sent to {recipient_email} for scenario '{scenario_name}'")
        return True
    except Exception as e:
        logger.error(f"Failed to send email to {recipient_email}: {e}")
        return False
