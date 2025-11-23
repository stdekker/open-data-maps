<?php

class GeoJSON {
    public static function read($file) {
        if (!file_exists($file)) {
            throw new Exception("File not found: $file");
        }
        $content = file_get_contents($file);
        $json = json_decode($content, true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            throw new Exception("Invalid JSON: " . json_last_error_msg());
        }
        return $json;
    }

    public static function write($file, $data) {
        $json = json_encode($data, JSON_UNESCAPED_SLASHES);
        if (json_last_error() !== JSON_ERROR_NONE) {
            throw new Exception("Error encoding JSON: " . json_last_error_msg());
        }
        file_put_contents($file, $json);
    }
}
