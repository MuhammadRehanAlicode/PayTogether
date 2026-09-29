import apps.tours.models
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('tours', '0002_tour_join_code_tourmember'),
    ]

    operations = [
        migrations.AlterField(
            model_name='tour',
            name='join_code',
            field=models.CharField(default=apps.tours.models.generate_join_code, editable=False, max_length=8, unique=True),
        ),
    ]
