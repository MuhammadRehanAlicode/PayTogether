from django.db import models

from django.contrib.auth.models import ( 
    AbstractBaseUser,
     PermissionsMixin,
)
from .managers import UserManager

# Create your models here.
class User(AbstractBaseUser, PermissionsMixin):
    email = models.EmailField(unique=True)
    full_name = models.CharField(max_length=30)
    phone = models.CharField(max_length=30, blank=True, null=True)
    bank_name = models.CharField(max_length=100, blank=True)
    bank_account_title = models.CharField(max_length=100, blank=True)
    bank_account_number = models.CharField(max_length=50, blank=True)
    raast_id = models.CharField(max_length=100, blank=True)
    easypaisa_number = models.CharField(max_length=30, blank=True)
    jazzcash_number = models.CharField(max_length=30, blank=True)
    profile_image = models.ImageField(upload_to='profile_images/', default='profile_images/default.jpg')
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    date_joined = models.DateTimeField(auto_now_add=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = UserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['full_name', 'phone']

    class Meta:
        db_table = 'User'
        ordering = ['-created_at']

    def __str__(self):
        return self.email
