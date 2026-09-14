"""Reject invalid ROM table instructions before interpreting victory metadata."""
import struct, unittest
from extract_results import table,jump

class ResultsTables(unittest.TestCase):
    def test_jump(self):
        for op in (2,3):
            self.assertEqual(jump(struct.pack('>I',(op<<26)|((0x805370f0&0xfffffff)>>2)),0),0x2d370f0)
    def test_bad_jump(self):
        with self.assertRaises(ValueError):jump(bytes(4),0)
    def test_table(self):
        self.assertEqual(table(struct.pack('>II',0x3c0d8049,0x35adb8f0),0,13),0x2c9b8f0)
    def test_wrong_register(self):
        for hi,lo in [(0x3c0e8049,0x35adb8f0),(0x3c0d8049,0x35aeb8f0),(0x3c0d8049,0x25adb8f0)]:
            with self.assertRaises(ValueError):table(struct.pack('>II',hi,lo),0,13)
    def test_unmapped_pointer(self):
        with self.assertRaises(ValueError):table(struct.pack('>II',0x3c0d8000,0x35ad0000),0,13)
if __name__=='__main__':unittest.main()
