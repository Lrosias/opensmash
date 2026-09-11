"""Tests for binary event boundaries and bounded control-flow translation."""
import struct
import unittest
from unittest.mock import patch
from extract_roster import script

class ScriptTests(unittest.TestCase):
    def decode(self, words):
        with patch('extract_roster.offset', lambda address: address-0x80400000):
            return script(struct.pack('>'+'I'*len(words),*words),0x80400000)

    def test_attack_offset_is_two_words(self):
        words=[0x1c000000,0x00100020,0x04000003,0]
        self.assertEqual(self.decode(words)[0],words)

    def test_eight_byte_extensions_skip_payload(self):
        words,omissions=self.decode([0xd6000000,0xdeadbeef,0xd9000000,0xdeadbeef,0x04000002,0])
        self.assertEqual(words,[0x04000002,0])
        self.assertEqual([len(x['words']) for x in omissions],[2,2])

    def test_subroutine_returns_to_caller(self):
        words=[34<<26,0x80400010,0x04000002,0,0x04000003,35<<26]
        self.assertEqual(self.decode(words)[0],[0x04000003,0x04000002,0])

    def test_loop_unrolls_finite_repetitions(self):
        self.assertEqual(self.decode([(32<<26)|3,0x04000002,33<<26,0])[0],[0x04000002]*3+[0])

    def test_zero_count_loop_rejects(self):
        with self.assertRaisesRegex(ValueError,'Unbounded loop'):
            self.decode([32<<26,33<<26,0])

    def test_cycle_rejects(self):
        with self.assertRaisesRegex(ValueError,'cyclic'):
            self.decode([36<<26,0x80400000])

    def test_runtime_loop_relocates_with_a_wait(self):
        relocations=[]
        with patch('extract_roster.offset', lambda address: address-0x80400000):
            words,_=script(struct.pack('>3I',0x04000002,36<<26,0x80400000),0x80400000,relocations)
        self.assertEqual(words,[0x04000002,36<<26,0])
        self.assertEqual(relocations,[(2,0)])

    def test_parallel_timing_stream_is_retained(self):
        relocations=[]
        with patch('extract_roster.offset', lambda address: address-0x80400000):
            words,_=script(struct.pack('>6I',46<<26,0x8040000c,0,0x54000001,0x04000003,0),0x80400000,relocations)
        self.assertEqual(words,[46<<26,0,0,0x54000001,0x04000003,0])
        self.assertEqual(relocations,[(1,3)])

    def test_zero_time_runtime_cycle_is_rejected(self):
        with patch('extract_roster.offset', lambda address: address-0x80400000):
            with self.assertRaisesRegex(ValueError,'cyclic'):
                script(struct.pack('>2I',36<<26,0x80400000),0x80400000,[])

    def test_throw_descriptor_is_copied_and_relocated(self):
        relocations=[];throw=[180,15,45,100,0,30,1]
        with patch('extract_roster.offset', lambda address: address-0x80400000):
            words,_=script(struct.pack('>10I',12<<26,0x8040000c,0,*throw),0x80400000,relocations)
        self.assertEqual(words,[12<<26,0,0,*throw])
        self.assertEqual(relocations,[(1,3)])

    def test_physics_extensions_are_retained(self):
        words=[0xd142c800,0xd442c800,0xd5000001,0xd7000001,0xda000000,0]
        self.assertEqual(self.decode(words)[0],words)

    def test_relative_file_jump_ends_absolute_stream(self):
        self.assertEqual(self.decode([0x04000002,0xdb000270,0])[0],[0x04000002,0xdb000270])

    def test_known_effects_and_attack_voices_are_retained(self):
        words=[(38<<26)|(31<<10),0,0,0,20<<26,0]
        self.assertEqual(self.decode(words),(words,[]))

    def test_custom_effect_remains_explicitly_omitted(self):
        words,omissions=self.decode([(38<<26)|(117<<10),0,0,0,0])
        self.assertEqual(words,[0]);self.assertEqual(len(omissions),1)

    def test_known_custom_trail_is_retained(self):
        words=[(51<<26)|(2<<18),0]
        self.assertEqual(self.decode(words),(words,[]))

    def test_unknown_extension_rejects(self):
        with self.assertRaisesRegex(ValueError,'Unknown extension'):
            self.decode([0xdc000000,0])

    def test_truncated_attack_rejects(self):
        with self.assertRaises(struct.error):
            self.decode([3<<26,0])

if __name__=='__main__':unittest.main()
