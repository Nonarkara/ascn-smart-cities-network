# XML Parser

`fxp.cjs` is the standalone CommonJS bundle of fast-xml-parser 5.8.0 (MIT), copied unchanged from its published package. It is used only by the news ingestion code and bundled into the Pages Function, not served as a browser script.

Upstream: https://github.com/NaturalIntelligence/fast-xml-parser

The news reader rejects DOCTYPE and ENTITY declarations before parsing, limits response sizes, and renders only validated headline metadata.
