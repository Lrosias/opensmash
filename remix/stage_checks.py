"""Stage local browser fixtures after building; rebuilding removes them again."""
from pathlib import Path
import shutil
from extract_marth import ROOT
for name in ['remix-check.html','pair-check.html','title-check.html']:shutil.copyfile(ROOT/'remix/fixtures'/name,ROOT/'yougame/dist'/name)
shutil.copyfile(ROOT/'yougame/tests/.sdk-sync.mjs',ROOT/'yougame/dist/sdk-test.mjs')
