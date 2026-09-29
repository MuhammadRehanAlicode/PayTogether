from django.db import models
from django.conf import settings
import secrets
import string

def generate_join_code():
	"""Generate a code for normal and bulk-created Tour instances."""
	alphabet = string.ascii_uppercase + string.digits
	return ''.join(secrets.choice(alphabet) for _ in range(8))


# Create your models here.


class tour(models.Model):
	JOIN_CODE_LENGTH = 8

	title = models.CharField(max_length=200)
	description = models.TextField(blank=True)
	price = models.DecimalField(max_digits=12, decimal_places=2)
	image = models.ImageField(upload_to='tours/', blank=True, null=True)
	states = models.CharField(max_length=100, blank=True)
	destination = models.CharField(max_length=200)
	created_by = models.ForeignKey(
		settings.AUTH_USER_MODEL,
		on_delete=models.CASCADE,
		related_name='tours',
	)
	created_at = models.DateTimeField(auto_now_add=True)
	updated_at = models.DateTimeField(auto_now=True)
	join_code = models.CharField(max_length=JOIN_CODE_LENGTH, unique=True, editable=False, default=generate_join_code)

	@classmethod
	def generate_join_code(cls):
		"""Return an easily shareable code that is not already in use."""
		while True:
			code = generate_join_code()
			if not cls.objects.filter(join_code=code).exists():
				return code

	def save(self, *args, **kwargs):
		if not self.join_code:
			self.join_code = self.generate_join_code()
		super().save(*args, **kwargs)

	def __str__(self):
		return self.title


class TourMember(models.Model):
	"""A user's membership of a tour joined with a share code."""
	user = models.ForeignKey(
		settings.AUTH_USER_MODEL,
		on_delete=models.CASCADE,
		related_name='tour_memberships',
	)
	tour = models.ForeignKey(
		tour,
		on_delete=models.CASCADE,
		related_name='memberships',
	)
	joined_at = models.DateTimeField(auto_now_add=True)

	class Meta:
		constraints = [
			models.UniqueConstraint(fields=['user', 'tour'], name='unique_tour_member'),
		]
		ordering = ['-joined_at']

	def __str__(self):
		return f'{self.user} joined {self.tour}'
