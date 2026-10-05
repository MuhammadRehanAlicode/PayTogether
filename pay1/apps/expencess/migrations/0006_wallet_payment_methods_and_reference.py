from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('expencess', '0005_raast_payment_method'),
    ]

    operations = [
        migrations.AlterField(
            model_name='settlementpayment',
            name='payment_method',
            field=models.CharField(
                choices=[
                    ('cash', 'Cash'),
                    ('bank', 'Bank transfer'),
                    ('raast', 'Raast transfer (manual confirmation)'),
                    ('easypaisa', 'Easypaisa (manual confirmation)'),
                    ('jazzcash', 'JazzCash (manual confirmation)'),
                ],
                max_length=32,
            ),
        ),
        migrations.AddField(
            model_name='settlementpayment',
            name='transaction_reference',
            field=models.CharField(blank=True, max_length=100),
        ),
    ]
