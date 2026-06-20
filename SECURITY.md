# Security Policy

Loop it is a local Agent Skill and installer. It should not require secrets to install or run.

## Supported versions

| Version | Status |
| --- | --- |
| `0.1.x` | Supported during initial public release |

## Report a vulnerability

Please do not post credentials, private repository data, or exploitable details in a public issue.

Report security concerns through GitHub Security Advisories for this repository, or open a minimal public issue that says a private security report is needed.

## Security boundaries

Loop it should:

- install files only into explicit project or global agent-skill directories;
- fail before replacing an existing install unless `--force` is provided;
- avoid network calls during normal CLI operation;
- avoid reading or writing credentials;
- keep production writes, deploys, external messages, destructive git operations, and irreversible data changes outside the loop unless the user explicitly approves them.
