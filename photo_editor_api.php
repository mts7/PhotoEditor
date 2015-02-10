<?php
/**
 * This file handles the PHP API necessary for the photo editor.
 *
 * @author Mike Rodarte
 *
 * This file requires helpers.php from PDOWrapper (https://github.com/mts7/PDOWrapper/blob/master/helpers.php)
 */

require_once 'helpers.php';
// only allow users from the office to use this application
if (!from_office()) {
    header('Location: /');
    die();
}

require_once 'PhotoEditor.php';

// API piece
if (isset($_POST['action'])) {
    $action = $_POST['action'];
    $editor = new PhotoEditor();

    switch ($action) {
        case 'crop':
            $file_name = $_POST['file'];
            $width = strip_non_alphanum($_POST['w']);
            $height = strip_non_alphanum($_POST['h']);
            $x = strip_non_alphanum($_POST['x']);
            $y = strip_non_alphanum($_POST['y']);
            $version = strip_non_alphanum($_POST['version']);
            $cropped = $editor->processCrop($file_name, $width, $height, $x, $y, $version);
            $output = $cropped ? 'true' : 'false';
            echo $output;
            break;
        case 'delete':
            $file_name = $_POST['file'];
            $editor->deleteHistory($file_name);
            break;
        case 'delete_edited':
            $file_name = $_POST['file'];
            $editor->deleteEdited($file_name);
            break;
        case 'init':
            $file_name = $_POST['file'];
            $output = $editor->init($file_name);
            echo $output;
            break;
        case 'rotate':
            $direction = strip_non_alphanum($_POST['direction']);
            $directory = $_POST['directory'];
            $file_name = $_POST['file'];
            $version = strip_non_alphanum($_POST['version']);
            $rotated = $editor->rotate($direction, $directory, $file_name, $version);
            $output = $rotated ? 'true' : 'false';
            echo $output;
            break;
        case 'save':
            $file_name = $_POST['file'];
            $original = $_POST['original'];
            $query_file = $_POST['query_file'];
            $save_dir = dirname($query_file).'/';
            $new_file = $editor->copyFinishedFile($file_name, $original, $save_dir);
            echo $new_file;
            break;
        case 'size':
            $file_name = isset($_POST['file']) ? $_POST['file'] : '';
            $output = $editor->size($file_name);
            echo $output;
            break;
    }

    exit;
}
