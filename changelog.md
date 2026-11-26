# Changelog

All notable changes to this project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

This project uses 4-digit versioning,
 while the last digit stands for non-functionality-notable change.

Since some minor versions are not created in release,
 this changelog accumulates those changes into released version.

## [1.1.3.0] - 

### Added

* Diff options such as:
  * Language for the word segmenter.
  * Granularity of the segmenter.
  * Whether ignore case when comparing.
* project: `<meta>` tag for app name, keywords, created time, and modified time.

### Fixed

* Wrong name and link of project's GitHub repository.

### Changed

* project: Using script to add license text to built HTML file.

### Fixed

## [1.1.2.0] - 2026-11-26

### Fixed

* renderer: Long (no white space) code does not wrap.

## [1.1.1.0] - 2026-11-26

### Added

Added functionality until this version.

* Diff functionality based on [`jsdiff`](https://github.com/kpdecker/jsdiff).
* 3 colours for each diff tag (add/remove/modify).
* Line aligned.
* Match modified line, but not only depends on the line-index.