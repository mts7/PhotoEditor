<?php
/**
 * @author Mike Rodarte
 *
 * Handle photo edits with cropping, resizing, and saving. It uses jQuery.jCrop.js for the cropping and
 * GD for the rotating, resizing, and saving.
 *
 * Uses helpers.php from PDOWrapper (https://github.com/mts7/PDOWrapper/blob/master/helpers.php)
 */

require_once 'helpers.php';


class PhotoEditor
{
    // members
    private $error_msg = '';
    private $initialized = false;
    private $root = '/home/user/';
    private $temp = 'photos/tmp/';
    private $temp_dir = '';


    public function __construct()
    {
        $this->temp_dir = $this->root . $this->temp;
    }


    /**
     * @param string $file Original file name (from query string)
     * @return string JSON object of version and file name
     * @uses PhotoEditor::$initialized
     * @uses PhotoEditor::$root
     * @uses PhotoEditor::$temp_dir
     * @uses is_string_ne() (from helpers.php)
     * @uses append_to_file_name() (from helpers.php)
     */
    public function init($file)
    {
        if ($this->initialized) {
            return json_encode(array('error' => 'ERROR: The object was already initialized.'));
        }
        if (!is_string_ne($file)) {
            return json_encode(array('error' => 'ERROR: There must be a file provided to initialize the script.'));
        }

        // check for directory traversal
        if (strstr(html_entity_decode($file), '..')) {
            return json_encode(array('error' => 'ERROR: Directory traversal is not enabled on this server.'));
        }
        // remove leading slash from file name
        if ($file[0] == '/') {
            $file = substr($file, 1);
        }

        $this->deleteHistory($file);

        $file_name = $this->root.$file;

        // make sure file exists
        if (!file_exists($file_name) || !is_file($file_name)) {
            if (is_string_ne($file_name)) {
                //echo 'File: '.$file_name.SL;
                // try temp directory
                $file_name = $this->temp_dir.basename($file_name);
                if (!file_exists($file_name) || !is_file($file_name)) {
                    return json_encode(array('error' => 'ERROR: The file {'.$file_name.'} was not found in the temp
                        directory.'));
                }
            } else {
                return json_encode(array('error' => 'ERROR: The file was not found where specified.'));
            }
        }

        $base_file = basename($file);
        $current_file = '';

        // copy image to tmp dir
        if (is_dir($this->temp_dir)) {
            copy($file_name, $this->temp_dir.$base_file);
            $new_file = append_to_file_name($base_file, '0');
            copy($file_name, $this->temp_dir.$new_file);
            if (is_file($this->temp_dir.$new_file)) {
                $current_file = $new_file;
            }
        }

        $edited_file = append_to_file_name($base_file, '_c');
        $edited_path = str_replace($base_file, $edited_file, $file_name);
        $edited = is_file($edited_path) && file_exists($edited_path) ? 1 : 0;

        $this->initialized = true;

        return json_encode(array('temp_dir' => $this->temp, 'current_file' => $current_file, 'edited' => $edited));
    }


    /**
     * Copy a file to the designated directory with an ending appended to the file name.
     * @param string $file_name New file name
     * @param string $original Original file name
     * @param string $save_dir Directory to save (copy) the image
     * @param string $ending String to append to the file name
     * @return bool|string New full web path to the image
     * @uses PhotoEditor::error()
     * @uses PhotoEditor::$original
     * @uses append_to_file_name() (from helpers.php)
     */
    public function copyFinishedFile($file_name = '', $original = '', $save_dir = '', $ending = '_c') {
        if (!is_string_ne($file_name) || strstr($file_name, '..')) {
            $this->error('ERROR: Invalid file name');
            return false;
        }

        if (!is_string_ne($original) || strstr($original, '..')) {
            $this->error('ERROR: Invalid original file name');
            return false;
        }

        if (!is_string_ne($save_dir) || strstr($save_dir, '..')) {
            $this->error('ERROR: Invalid save directory');
            return false;
        }

        $file_path = $this->temp_dir . $file_name;
        if (!is_file($file_path)) {
            $this->error('ERROR: file '.$file_path.' is not a file');
            return false;
        }
        $save_path = $this->root.$save_dir;
        if (!is_dir($save_path)) {
            $this->error('ERROR: '.$save_dir.' is not a valid directory');
            return false;
        }

        $new_file = append_to_file_name($original, $ending);
        $new_path = $save_path.$new_file;
        $copied = copy($file_path, $new_path);
        if (!$copied || !file_exists($new_path)) {
            $this->error('ERROR: copy failed');
            return false;
        }

        return $new_path;
    }


    /**
     * Delete a file from the server
     * @param string $original File name with path
     * @return bool
     * @uses PhotoEditor::error()
     * @uses PhotoEditor::$root
     * @uses is_string_ne() (from helpers.php)
     * @uses append_to_file_name() (from helpers.php)
     */
    public function deleteEdited($original = '')
    {
        if (!is_string_ne($original) || strstr($original, '..')) {
            $this->error('ERROR: Invalid file name');
            return false;
        }

        $file = basename($original);
        $path = str_replace($file, '', $original);
        $edited = append_to_file_name($file, '_c');
        $edit_path = $this->root.$path.$edited;

        if (!is_file($edit_path)) {
            $this->error('ERROR: File not found');
            return false;
        }

        return unlink($edit_path);
    }


    /**
     * Delete all files matching a pattern based on the name of the file provided.
     * @param string $original Original file name to use for matching
     * @return bool
     * @uses PhotoEditor::error()
     * @uses PhotoEditor::$original
     * @uses PhotoEditor::$temp_dir
     * @uses is_array_ne() (from helpers.php)
     */
    public function deleteHistory($original)
    {
        if (!is_string_ne($original) || strstr($original, '..')) {
            $this->error('ERROR: Invalid file name');
            return false;
        }

        $file = basename($original);
        // remove all temp images matching that file name
        // get everything before the last dot
        $last_dot = strrpos($file, '.');
        if (!$last_dot) {
            // there is no dot
            $this->error('ERROR: there is no dot');
            return false;
        }
        $pattern = '/^'.substr(str_replace('-', '\-', $file), 0, $last_dot).'/';
        //echo $pattern.SL;
        $dirs = scandir($this->temp_dir);
        if (!is_array_ne($dirs)) {
            $this->error('ERROR: the temp directory is invalid');
            return false;
        }
        foreach($dirs as $dir) {
            if (preg_match($pattern, $dir)) {
                if (is_file($this->temp_dir.$dir)) {
                    chmod($this->temp_dir . $dir, 0666);
                    unlink($this->temp_dir . $dir);
                    //echo 'deleted '.$dir.SL;
                }
            }
        }

        return true;
    }


    /**
     * Get or set the error message
     * @param string $msg Error message
     * @return string Last error message set
     * @uses PhotoEditor::$error_msg
     */
    public function error($msg = '')
    {
        if (is_string_ne($msg)) {
            $this->error_msg = $msg;
        }
        return $this->error_msg;
    }


    /**
     * Return the extension of the file (assuming there is a . in the name)
     * @param string $file File name
     * @return string
     */
    private function getExt($file = '') {
        $array = explode('.', $file);
        $ext = strtolower(array_pop($array));

        // change jpeg to jpg
        $ext = ( $ext == 'jpeg') ? 'jpg' : $ext;

        return $ext;
    }


    /**
     * Crop a photo using GD2 and the specified parameters
     * @param string $source Source file name
     * @param int $form_width Width
     * @param int $form_height Height
     * @param int $x X position of top left corner
     * @param int $y Y position of top left corner
     * @param string $appendage String to add to the end of the file name
     * @return bool
     * @uses PhotoEditor::error()
     * @uses PhotoEditor::$temp_dir
     * @uses PhotoEditor::getExt()
     * @uses append_to_file_name() (from helpers.php)
     */
    public function processCrop($source = '', $form_width = 0, $form_height = 0, $x = 0, $y = 0, $appendage = '') {
        if (!is_string_ne($source) || strstr($source, '..')) {
            $this->error('ERROR: Invalid source');
            return false;
        }

        if (!($x >= 0 && $y >= 0)) {
            $this->error('ERROR: Invalid x and y');
            return false;
        }

        if (!($form_width  != false && !empty($form_width)  && $form_width > 0  &&
            $form_height != false && !empty($form_height) && $form_height > 0 )) {
            $this->error('ERROR: width and/or height are invalid '.$form_width.'x'.$form_height);
            return false;
        }

        $file_name = $this->temp_dir.$source;
        // make sure subCrop is the one doing the work, not skip
        if ($source == FALSE || !file_exists($file_name)) {
            // the image file does not exist
            $this->error('ERROR: Invalid source: '.$file_name);
            return false;
        }

        $ext = $this->getExt($source);
        switch ($ext) {
            case 'jpg':
                $img_r = imagecreatefromjpeg($file_name);
                break;
            case 'png':
                $img_r = imagecreatefrompng($file_name);
                break;
            default:
                $img_r = '';
                break;
        }

        // make sure the function returned a resource
        if (empty($img_r) || !$img_r) {
            $this->error('ERROR: Invalid resource for extension '.$ext);
            return false;
        }

        $target_width = $form_width;
        $target_height = $form_height;

        if (!($target_width > 0 && $target_height > 0)) {
            $this->error('ERROR: invalid target dimensions: '.$target_width.'x'.$target_height);
            return false;
        }

        $dst_r = imagecreatetruecolor($target_width, $target_height);

        if (!$dst_r) {
            $this->error('ERROR: could not create true color image');
            return false;
        }

        $resampled = imagecopyresampled($dst_r, $img_r, 0, 0, $x, $y, $target_width, $target_height, $form_width,
            $form_height);

        if (!$resampled) {
            $this->error('ERROR: could not resample image');
            return false;
        }

        // set quality
        $quality = 100;

        // get destination file name like file_name.ext => file_name_m.ext
        $temp_destination = $this->temp_dir.append_to_file_name($source, $appendage);

        switch ($ext) {
            case 'jpg':
                $created = imagejpeg($dst_r, $temp_destination, $quality);
                break;
            case 'png':
                $png_quality = ($quality - 100) / 11.111111;
                $png_quality = round(abs($png_quality));
                $created = imagepng($dst_r, $temp_destination, $png_quality);
                break;
            default:
                $created = false;
                break;
        }

        return $created;
    }


    /**
     * Use GD2 to rotate the image 90 degrees to the left or right.
     * @param string $direction left or right
     * @param string $dir Relative directory of the image
     * @param string $file_name File name of the image
     * @param string $append Version or other string to append to the end of the [new] file name
     * @return bool
     * @uses PhotoEditor::$root
     * @uses PhotoEditor::error()
     * @uses PhotoEditor::getExt()
     * @uses is_string_ne() (from helpers.php)
     * @uses append_to_file_name() (from helpers.php)
     */
    public function rotate($direction = '', $dir = '', $file_name = '', $append = '') {
        if (!is_string_ne($dir) || strstr($dir, '..')) {
            $this->error('ERROR: Invalid directory');
            return false;
        }

        if (!is_string_ne($file_name) || strstr($dir, '..')) {
            $this->error('ERROR: Invalid file name');
            return false;
        }

        $file_name = basename($file_name);

        if (!is_string_ne($direction) || !is_file($this->root.$dir.$file_name)) {
            $this->error('ERROR: Invalid parameters.');
            return false;
        }

        $degrees = false;
        if ($direction == 'left') {
            $degrees = 90;
        } else if ($direction == 'right') {
            $degrees = 270;
        }

        if (!$degrees) {
            $this->error('ERROR: Invalid direction. Please specify left or right.');
            return false;
        }

        $ext = $this->getExt($file_name);
        // prepare the file and rotate it in the desired direction
        if ($ext == 'jpg') {
            $end = 'jpeg';
        } else if ($ext == 'png') {
            $end = 'png';
        } else {
            $end = false;
        }

        if (!$end) {
            $this->error('ERROR: Invalid extension.');
            return false;
        }

        // append $append to the file name
        if (!is_string_ne($append)) {
            $append = 'rotated';
        }
        $new_name = append_to_file_name($file_name, $append);

        // rotate the image
        $im = call_user_func('imagecreatefrom'.$end, $this->root.$dir.$file_name);
        $rotate = imagerotate($im, $degrees, 0);
        $rotated = call_user_func('image'.$end, $rotate, $this->root.$dir.$new_name);

        return $rotated;
    }


    /**
     * Find the dimensions and other specs of the image
     * @param string $file_name File name in temp directory
     * @return string
     * @uses PhotoEditor::$temp_dir
     * @uses is_string_ne() (from helpers.php)
     */
    public function size($file_name = '')
    {
        if (!is_string_ne($file_name) || strstr($file_name, '..')) {
            return json_encode(array('error' => 'ERROR: Invalid file name'));
        }

        $file = $this->temp_dir . basename($file_name);
        if (!is_file($file)) {
            return json_encode(array('error' => 'ERROR: file does not exist'));
        }

        $size = getimagesize($file);
        if (!is_array_ne($size)) {
            return json_encode(array('error' => 'ERROR: Invalid file'));
        }

        return json_encode(array('width' => $size[0], 'height' => $size[1], 'type' => $size[2], 'attr' => $size[3],
            'mime' => $size['mime'], 'channels' => $size['channels'], 'bits' => $size['bits']));
    }
}
