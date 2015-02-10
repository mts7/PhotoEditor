function Actions() {
    // set the selectors below
    this.containers = {
        current: '#current_version',
        undo: '#undo_history',
        redo: '#redo_history',
        save: '#save'
    };
    this.elements = {
        redo: '#redo',
        undo: '#undo'
    };
    this.classes = {
        enable: 'option-enabled',
        disable: 'option-disabled'
    };
    this.saveImageActive = '/images/icons/fugue/icons-24/disk.png';
    this.saveImageInactive = '/images/icons/fugue/icons-24/disk-black.png';
    // end user config

    this.active = null;
    this.collection = [];
    this.debug = [];

    this.doAction = function(action) {
        // remove all redo history
        for (var v in this.collection) {
            if (this.collection.hasOwnProperty(v)) {
                if (this.active !== null && $.isNumeric(this.active) && v > this.active) {
                    this.collection.splice(v, 1);
                }
            }
        }
        // add action to collection
        this.collection.push(action);
        // set active to the last element index
        this.active = this.collection.length - 1;
        // update stuff
        this.update();
    };

    this.undo = function(v) {
        // set active to the one clicked
        if (this.collection[v] !== undefined) {
            this.active = v;
        } else {
            this.debug.push('undo: passed version does not exist in collection');
        }
        this.update();
        newest_version = v;
        var undo_file = get_current_file_name(v);
        $('.image_temp_display').attr('src', '/' + tempDir + undo_file);
        centerImage();
    };

    this.redo = function(v) {
        this.undo(v);
    };

    this.getHtml = function(v) {
        var html = '';
        if (this.collection[v] !== undefined) {
            var val = this.collection[v];
            html += '<div data-version="' + v + '" class="history-version">' + val + '</div>' + "\n";
        } else {
            this.debug.push('getHtml: value v not found in collection');
        }
        return html;
    };

    this.update = function() {
        // strings for output
        var undoStr = '';
        var redoStr = '';
        var current = '';

        // loop through the collection
        for (var v in this.collection) {
            // skip any values that are not properties
            if (!this.collection.hasOwnProperty(v)) {
                continue;
            }

            // put the HTML for the version in the right place
            if (v < this.active) {
                undoStr = this.getHtml(v) + undoStr;
            } else if (v > this.active) {
                redoStr = redoStr + this.getHtml(v);
            } else if (v == this.active) {
                current = this.getHtml(v);
            } else {
                this.debug.push('update: unknown value v');
            }
        }

        // set the HTML in the containers
        $(this.containers.undo).html(undoStr);
        $(this.containers.current).html(current);
        $(this.containers.redo).html(redoStr);

        // update the save image
        if (this.active == 0) {
            $(this.containers.save).attr('src', this.saveImageInactive).addClass(this.classes.disable);
        } else {
            $(this.containers.save).attr('src', this.saveImageActive).removeClass(this.classes.disable);
        }

        // change state of redo
        if (redoStr.length == 0) {
            $(this.elements.redo).addClass(this.classes.disable);
        } else {
            $(this.elements.redo).removeClass(this.classes.disable);
        }

        if (undoStr.length == 0) {
            $(this.elements.undo).addClass(this.classes.disable);
        } else {
            $(this.elements.undo).removeClass(this.classes.disable);
        }

        $('#save_message').html('').hide();
    };
}


function Querystring()
{
// get the query string, ignore the ? at the front.
	var querystring=location.search.substring(1,location.search.length);

    // parse out name/value pairs separated via &
	var args = querystring.split('&');

    // split out each name = value pair
	for (var i=0;i<args.length;i++)
	{
		var pair = args[i].split('=');

		// Fix broken unescaping
		temp = unescape(pair[0]).split('+');
		name = temp.join(' ');

		temp = unescape(pair[1]).split('+');
		value = temp.join(' ');

		this[name]=value;
	}

	this.get=Querystring_get;
}


function Querystring_get(strKey,strDefault)
{
	var value=this[strKey];
	if (value==null)
	{
		value=strDefault;
	}

	return value;
}

var api = 'photo_editor_api.php';
var actions = new Actions();
var hasEdit = false;
var jcrop_api = null;
var newest_version = Number(0);
var qs = new Querystring();
var version = Number(0);

// set these with the init AJAX
var currentFile = '';
var originalFile = '';
var tempDir = '';

$(document).ready(function(){
    // initialize the API
    var file = qs.file !== undefined ? qs.file : '';
    $.ajax({
        url: api,
        type: 'POST',
        dataType: 'json',
        data: {
            action: 'init',
            file: file
        }
    })
    .done(function(obj) {
        try {
            if (!obj.hasOwnProperty('error')) {
                if (obj.hasOwnProperty('current_file')) {
                    originalFile = removeLastCharFound(obj['current_file'], newest_version);
                    currentFile = originalFile;
                }
                if (obj.hasOwnProperty('temp_dir')) {
                    tempDir = obj['temp_dir'];
                }
                if (obj.hasOwnProperty('edited')) {
                    hasEdit = !!obj['edited'];
                    if (!hasEdit) {
                        $('#revert').hide();
                    }
                }
                if (originalFile.length == 0 || tempDir.length == 0) {
                    console.warn('Init failed and this will not work.');
                } else {
                    $('.image_temp_display').attr('src', tempDir + currentFile);
                    centerImage();
                }
            } else {
                console.warn(obj.error);
            }
        } catch (ex) {
            console.warn('Init failed. ', obj);
        }
    });

    var $undoHistoryLayer = $('#undo_history_layer');
    var $redoHistoryLayer = $('#redo_history_layer');
    var $undoHistory = $('#undo_history');
    var $redoHistory = $('#redo_history');

    $(document).on('click', '.history-layer', function() {
        // close menus, cancel crop
        $undoHistoryLayer.hide();
        $redoHistoryLayer.hide();
        cancel_crop();
    });

    $('#crop_input').hide();
    actions.doAction('Original');

    $('#rotate-left').on('click', function() {
        if ($(this).hasClass('option-disabled')) {
            return false;
        }
        rotate('left');
    });

    $('#rotate-right').on('click', function() {
        if ($(this).hasClass('option-disabled')) {
            return false;
        }
        rotate('right');
    });

    $('#crop').on('click', function() {
        if ($(this).hasClass('option-disabled')) {
            return false;
        }
        crop();
    });

    $('#save').on('click', function() {
        if ($(this).hasClass('option-disabled')) {
            return false;
        }
        save_image();
    });

    $('#accept').on('click', function() {
        crop_photo();
    });

    $('#cancel').on('click', function() {
        cancel_crop();
    });

    $('#undo').on('click', function() {
        if ($(this).hasClass('option-disabled')) {
            return false;
        }
        if ($undoHistoryLayer.is(':visible')) {
            $undoHistoryLayer.hide();
            $undoHistory.hide();
        } else {
            $undoHistoryLayer.css('display', 'inline-block');
            $undoHistory.show();
        }
        $redoHistoryLayer.hide();
    });

    $('#redo').on('click', function() {
        if ($(this).hasClass('option-disabled')) {
            return false;
        }
        if ($redoHistoryLayer.is(':visible')) {
            $redoHistoryLayer.hide();
            $redoHistory.hide();
        } else {
            $redoHistoryLayer.css('display', 'inline-block');
            $redoHistory.show();
        }
        $undoHistoryLayer.hide();
    });

    $(document).on('click', '.history-version', function(e) {
        var $target = $(e.currentTarget);
        var uVersion = $target.data('version');
        if (uVersion === newest_version) {
            console.log('skipping the current version');
            return false;
        }
        actions.undo(uVersion);
        $('#undo_history_layer').hide();
        $('#redo_history_layer').hide();
    });

    $('#close').on('click', function() {
        var leave = false;
        if ($('#save').hasClass('option-disabled')) {
            leave = true;
        } else {
            leave = confirm('Would you like to close without saving?');
        }

        if (leave) {
            deleteHistory();
            if (typeof document.referrer !== 'undefined' && document.referrer.length > 5) {
                // go back to the previous page with a link to the new image
                window.location.href = document.referrer;
            } else {
                // close the window if there is no referrer
                window.location.href = '/';
            }
        }
    });

    $('#revert').on('click', function() {
        var file = qs.file !== undefined ? qs.file : '';
        var answer = confirm('Are you sure you want to delete the previously edited and saved image?');
        if (answer) {
            // delete the edited version of this image and hide the button
            $.ajax({
                url: api,
                type: 'POST',
                data: {
                    action: 'delete_edited',
                    file: file
                }
            })
            .done(function() {
                $('#revert').hide();
            });
        }
    });

    // make sure the toolbar height is the same as the image area
    fixHeights('.column');
    $('#tool_conclusion').hide();
    centerImage();
});


function append_to_file_name(name, end) {
    console.info('append_to_file_name(', name, ', ', end, ')');
    var pos_dot = name.lastIndexOf('.');
    var ext = name.substr(pos_dot);
    var begin = name.substr(0, pos_dot);

    return begin+end+ext;
}


function cancel_crop() {
    console.info('cancel_crop()');
    $('#tool_conclusion').hide();
    resetDisabled();
    try {
        jcrop_api.destroy();
    } catch (ex) {
        if (jcrop_api == null) {
            console.log('there is no jcrop api to destroy');
            return true;
        }
        console.log(jcrop_api);
        console.log(ex);
    }
    // clear the stuff jCrop adds to the image tag
    $('.image_temp_display').attr('style', '');
    $('#crop_input').hide();
    // clear values
    $('#x').text('');
    $('#y').text('');
    $('#x2').text('');
    $('#y2').text('');
    $('#w').text('');
    $('#h').text('');
}


function centerImage() {
    if (true) {
        return true;
    }
    var $img = $('.image_temp_display');

    var maxWidth = 800;
    var maxHeight = 600;

    var iWidth = $img.width();
    var iHeight = $img.height();

    var left = Math.round((maxWidth - iWidth) / 2);
    var ptop = Math.round((maxHeight - iHeight) / 2);

    //console.log(iWidth, ' x ', iHeight, ' & ', left, ' x ', ptop);

    $img.css({
        left: left,
        position: 'relative',
        top: ptop
    });
}


function crop() {
    console.info('crop()');
    $('#save_message').html('').hide();
    $('input[name="file_name"]').attr('value', currentFile);
    $('#crop_input').css({display: 'inline-block'});
    init_jcrop();
    //jcrop_api.enable();
    // display crop button
    console.log('displaying buttons');
    $('#tool_conclusion').css({display: 'table-cell'});
    // add option-disabled to the action buttons
    $('.tool').addClass('option-disabled');
    $('#tool_standard').find('.option').addClass('option-disabled');
}

function crop_photo() {
    console.info('crop_photo()');
    var old_current = currentFile;
    var new_version;
    var new_file;
    resetDisabled();
    if (version !== newest_version) {
        new_version = Number(newest_version) + 1;
        new_file = get_current_file_name(new_version);
        old_current = get_current_file_name(newest_version);
        //console.log('using newest version');
    } else {
        new_version = Number(version) + 1;
        new_file = append_to_file_name(currentFile, Number(new_version));
        //console.log('using version');
    }
    $('#tool_conclusion').hide();

    // call API for cropping
    $.ajax({
        url: api,
        dataType: 'text',
        type: 'POST',
        beforeSend: function() {
            $('#overlay, #overlay_content').show();
        },
        data: {
            action: 'crop',
            file: old_current,
            w: $('#w').text(),
            h: $('#h').text(),
            x: $('#x').text(),
            y: $('#y').text(),
            version: new_version
        }
    })
    .done(function(data) {
        if (data === 'true') {
            // update the version
            version = new_version;
            newest_version = new_version;
            // update the current file name
            //currentFile = append_to_file_name(currentFile, Number(version));
            currentFile = new_file;
            jcrop_api.destroy();
            $('.jcrop-holder').hide();
            // replace the image
            $('.image_temp_display').attr('src', '/' + tempDir + currentFile).attr('style', false).show();
            centerImage();
            actions.doAction('Cropped');
            $('#crop_input').hide();
        }
        cancel_crop();
    })
    .fail(function() {
        alert('crop photo failed');
    })
    .always(function() {
        $('#overlay, #overlay_content').hide();
    });
}


function deleteHistory() {
    console.info('deleteHistory');
    var file = qs.file !== undefined ? qs.file : '';
    $.ajax({
        url: 'photo_editor_api.php',
        type: 'POST',
        data: {
            action: 'delete',
            file: file
        }
    });
}


function get_current_file_name(last_one) {
    console.info('get_current_file_name(', last_one, ')');
    var file = originalFile;
    for(var i=1; i <= last_one; i++) {
        file = append_to_file_name(file, i);
    }
    return file;
}


function get_image_size(callback) {
    $.ajax({
        url: api,
        dataType: 'json',
        type: 'POST',
        beforeSend: function() {
            $('#overlay, #overlay_content').show();
        },
        data: {
            action: 'size',
            file: currentFile
        }
    })
    .done(function(data) {
        if (data) {
            if (typeof callback == 'function') {
                callback(data);
            }
        }
    })
    .fail(function() {
        alert('get image size failed');
    })
    .always(function() {
        $('#overlay, #overlay_content').hide();
    });
}


function init_jcrop() {
    console.info('init_jcrop');
    get_image_size(function(data) {
        var image_size = [data.width, data.height];
        console.log('image size: ', image_size);

        $('.image_temp_display').Jcrop({
            onChange: showCoords,
            onSelect: showCoords,
            boxWidth: 800,
            boxHeight: 600,
            trueSize: image_size
        }, function () {
            jcrop_api = this;
        });
    });
}


function resetDisabled() {
    $('.tool').removeClass('option-disabled');
    actions.update();
}


function rotate(direction) {
    console.info('rotate(', direction, ')');
    $('#save_message').html('').hide();
    var old_current = currentFile;
    console.log('old current file: ', old_current);
    var new_version;
    var new_file;
    if (version !== newest_version) {
        new_version = Number(newest_version) + 1;
        new_file = get_current_file_name(new_version);
        console.log('not newest: ', new_file);
        old_current = get_current_file_name(newest_version);
        console.log('using newest version');
    } else {
        new_version = Number(version) + 1;
        new_file = append_to_file_name(currentFile, Number(new_version));
        console.log('newest: ', new_file);
        console.log('using version');
    }
    //console.log('new version: '+new_version);
    //console.log('new_file: '+new_file);
    // call api, giving it direction, directory, file name, current version + 1
    var data = {
        action: 'rotate',
        direction: direction,
        directory: tempDir,
        file: old_current,
        version: new_version
    };
    console.log('data to send: ', data);
    $.ajax({
        url: api,
        dataType: 'text',
        type: 'POST',
        data: data,
        beforeSend: function() {
            $('#overlay, #overlay_content').show();
        }
    })
    .done(function(data) {
        if (data === 'true') {
            console.log('temp directory: ', tempDir);
            // update the version
            version = Number(new_version);
            console.log('version: ', version);
            newest_version = Number(new_version);
            console.log('newest version: ', newest_version);
            // update the current file name
            currentFile = new_file;
            console.log('currentFile: ', currentFile);
            // replace the image
            $('.image_temp_display').attr('src', '/' + tempDir + currentFile);
            centerImage();
            actions.doAction('Rotated ' + direction);
        }
    })
    .fail(function() {
        alert('rotate failed');
    })
    .always(function() {
        $('#overlay, #overlay_content').hide();
    });
}


function save_image() {
    $('#save_message').html('').hide();
    var file = qs.file !== undefined ? qs.file : '';
    $.ajax({
        url: api,
        dataType: 'text',
        type: 'POST',
        beforeSend: function() {
            $('#overlay, #overlay_content').show();
        },
        data: {
            action: 'save',
            file: currentFile,
            original: originalFile,
            query_file: file
        }
    })
    .done(function(data) {
        if (data.indexOf('ERROR') == -1) {
            $('#save').addClass('option-disabled');
            $('#save_message').html('Version ' + version + ' saved successfully.').css('display', 'inline-block');
        } else {
            $('#save_message').html(data).css('display', 'inline-block');
        }
    })
    .fail(function() {
        alert('save image failed');
    })
    .always(function() {
        $('#overlay, #overlay_content').hide();
    });
}


function showCoords(c) {
    //console.info('showCoords(', c, ')');
    // display whole numbers
    var obj = {};
    for (var k in c) {
        if (c.hasOwnProperty(k) && typeof c[k] == 'number') {
            obj[k] = Math.round(c[k]);
        }
    }
    $('#x').text(obj.x);
    $('#y').text(obj.y);
    $('#x2').text(obj.x2);
    $('#y2').text(obj.y2);
    $('#w').text(obj.w);
    $('#h').text(obj.h);
}


function strrpos(haystack,needle,offset){
    var i=-1;
    if (offset) {
        i=(haystack+'').slice(offset).lastIndexOf(needle);
        if (i!==-1) {
            i+=offset;
        }
    } else {
        i=(haystack+'').lastIndexOf(needle);
    }
    return i>=0?i:false;
}


function undo(last_one) {
    newest_version = last_one;
    var undo_file = get_current_file_name(last_one);
    $('.image_temp_display').attr('src', '/' + tempDir + undo_file);
    centerImage();
}
