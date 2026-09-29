import secrets
import string

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


def populate_join_codes(apps, schema_editor):
    Tour = apps.get_model('tours', 'tour')
    alphabet = string.ascii_uppercase + string.digits
    for item in Tour.objects.filter(join_code__isnull=True).iterator():
        while True:
            code = ''.join(secrets.choice(alphabet) for _ in range(8))
            if not Tour.objects.filter(join_code=code).exists():
                item.join_code = code
                item.save(update_fields=['join_code'])
                break


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('tours', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='tour',
            name='join_code',
            field=models.CharField(blank=True, max_length=8, null=True),
        ),
        migrations.RunPython(populate_join_codes, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='tour',
            name='join_code',
            field=models.CharField(editable=False, max_length=8, unique=True),
        ),
        migrations.CreateModel(
            name='TourMember',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('joined_at', models.DateTimeField(auto_now_add=True)),
                ('tour', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='memberships', to='tours.tour')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='tour_memberships', to=settings.AUTH_USER_MODEL)),
            ],
            options={'ordering': ['-joined_at']},
        ),
        migrations.AddConstraint(
            model_name='tourmember',
            constraint=models.UniqueConstraint(fields=('user', 'tour'), name='unique_tour_member'),
        ),
    ]
