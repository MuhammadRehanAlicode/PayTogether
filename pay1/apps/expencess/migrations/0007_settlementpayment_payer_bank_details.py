from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('expencess', '0006_wallet_payment_methods_and_reference'),
    ]

    operations = [
        migrations.AddField('settlementpayment', 'payer_bank_name', models.CharField(blank=True, max_length=100)),
        migrations.AddField('settlementpayment', 'payer_account_title', models.CharField(blank=True, max_length=100)),
        migrations.AddField('settlementpayment', 'payer_account_number', models.CharField(blank=True, max_length=50)),
    ]
