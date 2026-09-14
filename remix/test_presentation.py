"""Protect ROM table decoding against signed MIPS offsets and changed patches."""
import struct
import unittest
from extract_presentation import entry_table


class EntryTableTests(unittest.TestCase):
    def data(self, upper=0x3C0D804A, lower=0x8DAD8B30):
        data = bytearray(0xB86A8)
        struct.pack_into('>I', data, 0xB8664, upper)
        struct.pack_into('>I', data, 0xB86A4, lower)
        return data

    def test_sign_extended_table_displacement(self):
        self.assertEqual(entry_table(self.data()), 0x2C98B30)

    def test_positive_table_displacement(self):
        self.assertEqual(entry_table(self.data(lower=0x8DAD1230)), 0x2CA1230)

    def test_unexpected_opcode_rejected(self):
        with self.assertRaisesRegex(ValueError, 'instructions'):
            entry_table(self.data(lower=0x25AD8B30))

    def test_unmapped_pointer_rejected(self):
        with self.assertRaisesRegex(ValueError, 'Unmapped'):
            entry_table(self.data(upper=0x3C0D1000))
