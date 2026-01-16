#!/usr/bin/env python
"""Django's command-line utility for administrative tasks."""
import os
import sys


def main():
    """Run administrative tasks."""
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'marketday_project.settings')
    try:
        from django.core.management import execute_from_command_line
    except ImportError:
        # Try to auto-fix environment if venv exists but wasn't activated
        import glob
        base_dir = os.path.dirname(os.path.abspath(__file__))
        venv_site_packages = glob.glob(os.path.join(base_dir, 'venv', 'lib', 'python*', 'site-packages'))
        
        if venv_site_packages:
            sys.path.insert(0, venv_site_packages[0])
            try:
                from django.core.management import execute_from_command_line
            except ImportError as exc:
                raise ImportError(
                    "Couldn't import Django even after auto-detecting venv. "
                    "Please check your virtual environment."
                ) from exc
        else:
            raise ImportError(
                "Couldn't import Django. Are you sure it's installed and "
                "available on your PYTHONPATH environment variable? Did you "
                "forget to activate a virtual environment?"
            )
    execute_from_command_line(sys.argv)


if __name__ == '__main__':
    main()
