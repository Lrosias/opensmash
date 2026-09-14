# Release privacy check

Set `BUILD_PRIVATE_TERMS` to comma-separated private names and account identifiers in the local process. Do not commit that value or include it in packages. Run `python3 build_privacy.py scan <package-directory-or-zip>` from this directory. JavaScript callers can select Python with `YOUGAME_PYTHON`.

The scanner rejects matching identifiers, home/worktree paths, development files and symlinks. It inspects ZIP/O2R, gzip, zlib and UTF-16 data, including archive metadata. Unsupported archives, oversized members and missing identifier configuration fail closed. The 512 MiB decoded member limit does not limit the total size of a top-level ZIP. Split large members or extend the scanner deliberately; do not skip the check.

Run `python3 -m unittest discover -s . -p "test_*.py"`. The scanner reads files without repairing or uploading them. Passing is evidence for these patterns, not a guarantee against every form of identification or opaque format. Scan the final package again after signing or packaging and before upload.
