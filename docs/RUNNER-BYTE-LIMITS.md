# Stored runner cases and byte limits

The runner executes stored examples and test cases. There is no learner custom-input mode. Statement-valid inputs beyond today's fixtures are authoring risks if they are later stored; they are not evidence of a current failing submission.

`RUNNER_LIMITS` defines an inclusive 64,000-byte UTF-8 limit for positional JSON stdin and a 262,144-byte (256 KiB) limit for serialized result output. `serialization.ts` supplies the same argument ordering and byte calculation to execution and content validation. Recognized runner slugs are checked in `problemSchema`, covering loader/seed validation and admin create, edit and import for examples and visible/hidden tests. Custom study-only slugs keep their existing schema behavior.

The October 19 source review found 100 problems and 771 test cases within the existing input/output limits: largest test stdin 52,410 bytes and largest expected compact JSON 34,096 bytes. A synthetic, statement-valid Parcel Checkpoints case with one parcel and 10,664 ranges uses 63,998 bytes of stdin and produces 95,977 bytes of correct JSON. The old 90,000 limit rejected it; the revised QuickJS regression accepts it. Published problem JSON and content hashes are unchanged by this platform fix. Statement and explanation corrections require their own reviewed production reconciliation.

## Enforcement

- QuickJS counts UTF-8 bytes of each stdout/stderr chunk before retaining it. Each stream is bounded, complete stdout is compared structurally, and only 4,000 characters per stream are returned for display/storage.
- Browser Run bounds the serialized JSON result by UTF-8 bytes before worker transfer and rechecks the received result. Its diagnostic buffer remains 4,000 characters. Existing traversal/node guards bound serialization work as well.
- Python's generated harness emits compact UTF-8 JSON without a trailing newline; lone surrogates are JSON-escaped. Its mapper checks stdout/stderr bytes. An eventual executor must also enforce these limits while producing output; the mapper is not a substitute for runtime resource enforcement. Python remains unavailable in production until a runtime is verified and enabled.
- Judge0 requests a 256 KiB `max_file_size` and validates decoded output bytes. Base64 fields allow up to 349,528 characters; a full ten-case, three-stream response has a finite 10,497,104-byte transport bound including metadata allowance. Display/storage remains 4,000 characters. The official [API describes `max_file_size` in kilobytes](https://ce.judge0.com/); [the provider source](https://github.com/judge0/judge0/blob/v1.13.1/app/jobs/isolate_job.rb) applies it to files including captured streams. Tests use inert HTTP responses; they do not establish the configuration or behavior of a live external provider.

The JSON harnesses emit no trailing newline. Any additional whitespace a program/provider emits counts against its stream budget. The bounds apply to serialized text, so structurally equal JSON written with extra spaces or escaped Unicode can consume more bytes. A fixed result budget does not promise that every possible statement-maximum answer fits. Authors must keep each stored example/test runnable; the new validation rejects oversized fixtures before database writes.

Hidden-case details remain omitted from Submit responses and stored result objects. Raising the complete comparison budget does not increase the display limit or expose hidden output.
