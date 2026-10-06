from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0001_initial'),
    ]

    operations = [
        migrations.AddField('user', 'bank_name', models.CharField(blank=True, max_length=100)),
        migrations.AddField('user', 'bank_account_title', models.CharField(blank=True, max_length=100)),
        migrations.AddField('user', 'bank_account_number', models.CharField(blank=True, max_length=50)),
        migrations.AddField('user', 'raast_id', models.CharField(blank=True, max_length=100)),
        migrations.AddField('user', 'easypaisa_number', models.CharField(blank=True, max_length=30)),
        migrations.AddField('user', 'jazzcash_number', models.CharField(blank=True, max_length=30)),
    ]
