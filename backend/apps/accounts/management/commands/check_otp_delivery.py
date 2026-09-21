"""Send a throwaway code to one address/number to prove delivery is configured.

    python manage.py check_otp_delivery you@example.com
    python manage.py check_otp_delivery +250780000000

Picks the same channel the OTP flow would (email for anything with an ``@``,
SMS otherwise), reports which gateway handled it, and says plainly when the
gateway is a dev one that reaches nobody. No OTP row is written and no account
is touched -- this only exercises the delivery config.
"""
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from apps.accounts.services import (
    get_email_gateway,
    get_sms_gateway,
    is_email_identifier,
)


class Command(BaseCommand):
    help = "Send a test code to an email address or phone number."

    def add_arguments(self, parser):
        parser.add_argument("identifier", help="Email address or E.164 phone number.")

    def handle(self, *args, **options):
        identifier = options["identifier"].strip()
        if not identifier:
            raise CommandError("Give an email address or a phone number.")

        if is_email_identifier(identifier):
            gateway = get_email_gateway()
            config = f"EMAIL_BACKEND={settings.EMAIL_BACKEND}"
            if settings.EMAIL_HOST:
                config += f" host={settings.EMAIL_HOST}:{settings.EMAIL_PORT}"
                config += f" user={settings.EMAIL_HOST_USER or '(none)'}"
        else:
            gateway = get_sms_gateway()
            config = f"SMS_PROVIDER={settings.SMS_PROVIDER or '(none -> console)'}"

        self.stdout.write(f"channel: {type(gateway).__name__} | {config}")

        message = (
            "SmartMurima test code: 123456. "
            "If you are reading this, code delivery is configured correctly."
        )
        delivered = gateway.send(identifier, message)

        if not delivered:
            raise CommandError(
                f"Gateway reported failure for {identifier}. "
                "Check the error logged above and the credentials in .env."
            )

        if getattr(gateway, "dev_visible", False):
            self.stdout.write(
                self.style.WARNING(
                    f"Handed off, but {type(gateway).__name__} is a dev gateway: the "
                    "message was printed above, not delivered. Configure EMAIL_HOST "
                    "(email) or SMS_PROVIDER (SMS) in .env to send for real."
                )
            )
        else:
            self.stdout.write(
                self.style.SUCCESS(f"Sent to {identifier}. Check the inbox/handset.")
            )
