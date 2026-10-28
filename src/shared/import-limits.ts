export const IMPORT_FILE_BYTES = 2_000_000;
// Leave room for the action/source JSON envelope around a maximum-size file.
export const IMPORT_REQUEST_BYTES = IMPORT_FILE_BYTES + 128;
export const IMPORT_REQUESTS_PER_MINUTE = 12;
export const IMPORT_MAX_FILES = 5;
export const IMPORT_MAX_ROWS = 20_000;
