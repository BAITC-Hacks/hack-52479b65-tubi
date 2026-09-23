import os
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from app.settings import Settings


class SettingsTest(unittest.TestCase):
    def setUp(self):
        temp = self.enterContext(TemporaryDirectory(prefix='tubi-settings-'))
        self.root = Path(temp)
        self.enterContext(patch('app.settings.SERVER_DIR', self.root))
        self.enterContext(patch('app.settings.PROJECT_DIR', self.root))
        self.enterContext(patch.dict(os.environ, {}, clear=True))

    def write_env(self, content):
        (self.root / '.env').write_text(content, encoding='utf-8-sig')

    def test_new_instance_reads_updated_file_without_mutating_environment(self):
        self.write_env('OPENAI_API_KEY=first-test-key\nOPENAI_MODEL=first-model\n')
        first = Settings.from_env()
        self.write_env('OPENAI_API_KEY=second-test-key\nOPENAI_MODEL=second-model\n')
        second = Settings.from_env()
        self.assertEqual(first.openai_api_key, 'first-test-key')
        self.assertEqual(second.openai_api_key, 'second-test-key')
        self.assertEqual(second.openai_model, 'second-model')
        self.assertNotIn('OPENAI_API_KEY', os.environ)
        self.assertNotIn('OPENAI_MODEL', os.environ)
        self.assertNotIn('second-test-key', repr(second))

    def test_process_values_override_file_and_blank_key_disables_ai(self):
        self.write_env('OPENAI_API_KEY=file-test-key\nOPENAI_MODEL=file-model\n')
        with patch.dict(os.environ, {'OPENAI_API_KEY': '', 'OPENAI_MODEL': ' process-model '}):
            settings = Settings.from_env()
        self.assertEqual(settings.openai_api_key, '')
        self.assertEqual(settings.openai_model, 'process-model')

    def test_blank_model_and_missing_file_use_defaults(self):
        self.assertEqual(Settings.from_env().openai_api_key, '')
        self.write_env('OPENAI_MODEL="  "\n')
        self.assertEqual(Settings.from_env().openai_model, Settings.openai_model)

    def test_relative_database_path_is_stable_from_project_root(self):
        self.write_env('TUBI_DB_PATH=server/data/demo.sqlite3\n')
        self.assertEqual(Settings.from_env().db_path, (self.root / 'server/data/demo.sqlite3').resolve())
        absolute = (self.root / 'absolute.sqlite3').resolve()
        with patch.dict(os.environ, {'TUBI_DB_PATH': str(absolute)}):
            self.assertEqual(Settings.from_env().db_path, absolute)
