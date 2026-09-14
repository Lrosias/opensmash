import struct,unittest
from extract_costumes import costume_tables

class CostumeTableTests(unittest.TestCase):
 def data(self):
  data=bytearray(0x2C01000)
  struct.pack_into('>I',data,0x1361B4,0x0C100000)
  struct.pack_into('>4I',data,0x2C00040,0x3C098040,0x35290400,0x01244820,0x81290000)
  data[0xA7030:0xA7090]=bytes(range(96));data[0x2C00800:0x2C00860]=bytes(range(96))
  return data
 def test_patched_call_and_table_load(self):
  self.assertEqual(costume_tables(self.data()),(0x2C00400,0x2C00800))
 def test_call_must_be_jal(self):
  data=self.data();struct.pack_into('>I',data,0x1361B4,0)
  with self.assertRaisesRegex(ValueError,'selection call'):costume_tables(data)
 def test_changed_count_load_rejected(self):
  data=self.data();struct.pack_into('>I',data,0x2C00044,0x35280400)
  with self.assertRaisesRegex(ValueError,'count instructions'):costume_tables(data)
 def test_ambiguous_mapping_rejected(self):
  data=self.data();data[0x2C00900:0x2C00960]=bytes(range(96))
  with self.assertRaisesRegex(ValueError,'Ambiguous'):costume_tables(data)
