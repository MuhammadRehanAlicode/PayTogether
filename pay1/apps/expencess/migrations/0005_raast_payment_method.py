from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('expencess', '0004_alter_settlementpayment_status'),
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
                ],
                max_length=32,
            ),
        ),
    ]
