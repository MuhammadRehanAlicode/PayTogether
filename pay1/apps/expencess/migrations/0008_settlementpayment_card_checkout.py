from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('expencess', '0007_settlementpayment_payer_bank_details'),
    ]

    operations = [
        migrations.AlterField(
            model_name='settlementpayment',
            name='payment_method',
            field=models.CharField(choices=[
                ('cash', 'Cash'),
                ('bank', 'Bank transfer'),
                ('card', 'Card'),
                ('raast', 'Raast transfer (manual confirmation)'),
                ('easypaisa', 'Easypaisa (manual confirmation)'),
                ('jazzcash', 'JazzCash (manual confirmation)'),
            ], max_length=32),
        ),
        migrations.AlterField(
            model_name='settlementpayment',
            name='status',
            field=models.CharField(choices=[
                ('pending', 'Pending approval'),
                ('approved', 'Approved'),
                ('cancelled', 'Cancelled'),
            ], default='pending', max_length=10),
        ),
        migrations.AddField(
            model_name='settlementpayment',
            name='stripe_checkout_session_id',
            field=models.CharField(blank=True, max_length=100, null=True, unique=True),
        ),
    ]
