import os
import django
import sys

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'marketday_project.settings')
django.setup()

from django.contrib.auth import get_user_model

def reset_password():
    User = get_user_model()
    username = 'admin'
    password = '1234qwer'
    
    try:
        print(f"Checking for user '{username}'...")
        if User.objects.filter(username=username).exists():
            user = User.objects.get(username=username)
            print(f"User '{username}' found. ID: {user.id}")
            user.set_password(password)
            user.is_staff = True
            user.is_superuser = True
            user.save()
            print(f"SUCCESS: Password for '{username}' has been reset to '{password}'.")
        else:
            print(f"User '{username}' does not exist. Creating new superuser...")
            User.objects.create_superuser(username, 'admin@example.com', password)
            print(f"SUCCESS: Superuser '{username}' created with password '{password}'.")
            
    except Exception as e:
        print(f"ERROR: Failed to reset password: {str(e)}")
        sys.exit(1)

if __name__ == '__main__':
    reset_password()
