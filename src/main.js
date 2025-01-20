(() => {
    const _ = {};
    _.piexif = window.piexif;
    _.has_init = false;
    _.init = async () => {
        _.facebook.init();
        _.google.init();

        const is_authenticated = await _.check_auths();
        if (!is_authenticated) {
            const modal_auth = _.get_modal_auth();
            modal_auth.show();
        }
    };
    _.get_modal_auth = () => {
        if (!_.modal_auth) {
            const modal = document.getElementById('modal-auth');
            _.modal_auth = new bootstrap.Modal(modal);
        }
        return _.modal_auth;
    };
    _.check_auths = async () => {
        const response = _.facebook.is_authenticated() && _.google.is_authenticated() ? true : false;
        if (response && !_.has_init) {
            _.has_init = true;
            const modal_auth = _.get_modal_auth();
            modal_auth.hide();
            
            const albums = await _.facebook.get_albums();
            const sorted_albums = _.facebook.sort_albums(albums, 'name_asc');
            const node = _.facebook.display_albums(albums);
        }
        return response;
    };
    _.get_cookie = (name) => {
        const cookie_split = document.cookie.split(';');
        for (let i = 0; i < cookie_split.length; i++) {
            const split = cookie_split[i].replace(/^\s+/, '').split('=');
            if (split[0] === name) {
                split.shift();
                return decodeURIComponent(split.join('='));
            }
        }
    };
    _.set_cookie = (name, value, expiration) => {
        var attributes = [];
        if (expiration) {
            const date = new Date();
            date.setTime(date.getTime() + expiration);
            attributes.push('expires=' + date.toUTCString());
        }
        attributes.push('path=/');
        attributes.push('domain=' + window.location.host);
        if (window.location.protocol === 'https:') {
            attributes.push('Secure');
        }
        document.cookie = name + '=' + encodeURIComponent(value) + ';' + attributes.join(';');
    };
    _.convert_images_to_base64 = async (photos) => {
        console.log('converting images to base64...');
        const response = [];
        for (let i = 0; i < photos.length; i++) {
            console.log('parsing photo ' + (i + 1) + '/' + photos.length);
            const current_photo = photos[i];
            const base64_image = await _.load_image(current_photo.source);
            const exif = _.piexif.load(base64_image);
            const new_exif = _.add_exif(exif, current_photo);
            const exifbytes = _.piexif.dump(new_exif);
            const new_image = _.piexif.insert(exifbytes, base64_image);
            current_photo.source_base64 = new_image;
            response.push(current_photo);
        }
        return response;
    };
    _.load_image = (src) => {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.onload = () => {
                const reader = new FileReader();
                reader.onloadend = function() {
                    resolve(reader.result);
                };
                reader.readAsDataURL(xhr.response);
            };
            xhr.onerror = function() {
                reject();
            };
            xhr.open('GET', src);
            xhr.responseType = 'blob';
            xhr.send();
        });
    };
    _.add_timestamp_padding = (str) => {
        str = str.toString();
        return str.length === 2 ? str : ('0' + str);
    };
    _.add_exif = (exif, data) => {
        exif = exif || {};
        exif['0th'] = exif['0th'] || {};
        exif.Exif = exif.Exif || {};
        exif.GPS = exif.GPS || {};
        
        if (data.caption) {
            exif.Image = exif.Image || {};
            exif.Image.XPTitle = data.caption;
            exif.Image.ImageDescription = data.caption;
            exif.tEXt = exif.tEXt || {};
            exif.tEXt.Title = data.caption;
            exif.tEXt.Description = data.caption;
            exif.tEXt.Comment = data.caption;
        }
        
        if (data.timestamp) {
            const date = new Date(data.timestamp);
            const year = date.getFullYear();
            const month = _.add_timestamp_padding(date.getMonth() + 1);
            const day = _.add_timestamp_padding(date.getDate());
            const hour = _.add_timestamp_padding(date.getHours());
            const minute = _.add_timestamp_padding(date.getMinutes());
            const second = _.add_timestamp_padding(date.getSeconds());
            const parsed_timestamp = [year, month, day].join(':') + ' ' + [hour, minute, second].join(':');
            exif.Exif[_.piexif.ExifIFD.DateTimeOriginal] = parsed_timestamp;
            
            if (data.place && data.place.location) {
                exif.GPS[_.piexif.GPSIFD.GPSDateStamp] = parsed_timestamp;
            }
        }

        if (data.place && data.place.location && data.place.location.latitude && data.place.location.longitude) {
            const parsed_lat = parseFloat(data.place.location.latitude);
            const parsed_lng = parseFloat(data.place.location.longitude);
            exif.GPS[_.piexif.GPSIFD.GPSVersionID] = [7, 7, 7, 7];
            exif.GPS[_.piexif.GPSIFD.GPSLatitudeRef] = parsed_lat < 0 ? 'S' : 'N';
            exif.GPS[_.piexif.GPSIFD.GPSLatitude] = _.piexif.GPSHelper.degToDmsRational(parsed_lat);
            exif.GPS[_.piexif.GPSIFD.GPSLongitudeRef] = parsed_lng < 0 ? 'W' : 'E';
            exif.GPS[_.piexif.GPSIFD.GPSLongitude] = _.piexif.GPSHelper.degToDmsRational(parsed_lng);
        }

        return exif;
    };

    // FACEBOOK FUNCTIONS
    _.facebook = {};
    _.facebook.storage_key = 'fb_response';
    _.facebook.is_authenticated = () => {
        return _.facebook.user_id && _.facebook.access_token ? true : false;
    };
    _.facebook.init = () => {
        const btn = document.getElementById('btn-facebook-auth');

        const fb_response = _.get_cookie(_.facebook.storage_key);
        if (fb_response) {
            _.facebook.on_auth(JSON.parse(fb_response));
        }
        else {
            btn.onclick = function(e) {
                e.preventDefault();
                FB.login(function(response) {
                    if (response.authResponse) {
                        window.get_facebook_login_status();
                        //access_token = response.authResponse.accessToken;
                        //user_id = response.authResponse.userID;
                    }
                }, { scope: 'user_photos' });
            };
            window.get_facebook_login_status = () => {
                FB.getLoginStatus((response) => {
                    if (response.status === 'connected') {
                        const stored_response = {};
                        stored_response.userID = response.authResponse.userID;
                        stored_response.accessToken = response.authResponse.accessToken;

                        _.set_cookie(_.facebook.storage_key, JSON.stringify(stored_response), (response.authResponse.expiresIn * 1000));
                        _.facebook.on_auth(response.authResponse);
                    }
                });
            };
        
            window.fbAsyncInit = () => {
                FB.init({
                    appId: window.fb_app_id,
                    cookie: true,
                    version: 'v21.0'
                });
                
                FB.AppEvents.logPageView();
                window.get_facebook_login_status();
            };
            
            const s = document.createElement('script');
            s.async = true;
            s.defer = true;
            s.setAttribute('crossorigin', 'anonymous');
            s.src = 'https://connect.facebook.net/en_US/sdk.js#xfbml=1&version=v21.0&appId=' + window.fb_app_id;
            document.head.appendChild(s);
        }
    };
    _.facebook.on_auth = (response) => {
        _.facebook.user_id = response.userID;
        _.facebook.access_token = response.accessToken;
        
        const auth_container = document.getElementById('auth-facebook');
        auth_container.classList.add('active');
        auth_container.getElementsByClassName('btn')[0].disabled = true;
        _.check_auths();
    };
    _.facebook.sort_albums = (albums, type) => {
        switch (type) {
            case 'name_asc':
                return albums.sort((a, b) => {
                    if (a.name.toLocaleLowerCase() < b.name.toLocaleLowerCase()) return -1;
                    if (a.name.toLocaleLowerCase() > b.name.toLocaleLowerCase()) return 1;
                    return 0
                });
            case 'name_desc':
                return albums.sort((a, b) => {
                    if (a.name.toLocaleLowerCase() > b.name.toLocaleLowerCase()) return -1;
                    if (a.name.toLocaleLowerCase() < b.name.toLocaleLowerCase()) return 1;
                    return 0
                });
            case 'date_asc':
                return albums.sort((a, b) => {
                    if (new Date(a.created_time).getTime() < new Date(b.created_time).getTime()) return -1;
                    if (new Date(a.created_time).getTime() > new Date(b.created_time).getTime()) return 1;
                    return 0
                });
                break;
            case 'date_desc':
                return albums.sort((a, b) => {
                    if (new Date(a.created_time).getTime() > new Date(b.created_time).getTime()) return -1;
                    if (new Date(a.created_time).getTime() < new Date(b.created_time).getTime()) return 1;
                    return 0
                });
                break;
        }
    };
    _.facebook.display_albums = (albums) => {
        let html = '';
        html += '<table class="table">';
            html += '<thead>';
                html += '<tr>';
                    html += '<th class="album-name" scope="col">';
                        html += '<span class="table-header-title">Album</span>';
                        html += '<span class="table-header-icon">';
                            html += '<button type="button" data-action="sort_albums" data-sort="name_asc" class="table-header-icon-sort table-header-icon-sort-asc active"></button>';
                            html += '<button type="button" data-action="sort_albums" data-sort="name_desc" class="table-header-icon-sort table-header-icon-sort-desc"></button>';
                        html += '</span>';
                    html += '</th>';
                    html += '<th class="album-created-on" scope="col">';
                        html += '<span class="table-header-title">Created on</span>';
                        html += '<span class="table-header-icon">';
                            html += '<button type="button" data-action="sort_albums" data-sort="date_asc" class="table-header-icon-sort table-header-icon-sort-asc"></button>';
                            html += '<button type="button" data-action="sort_albums" data-sort="date_desc" class="table-header-icon-sort table-header-icon-sort-desc"></button>';
                        html += '</span>';
                    html += '</th>';
                    html += '<th class="album-action" scope="col">&nbsp;</th>';
                html += '</tr>';
            html += '</thead>';
            html += '<tbody>';
        
                albums.forEach((album) => {
                    const album_date = new Date(album.created_time);
                    const album_date_timestamp = album_date.toLocaleString();

                    html += `<tr data-album-name="${album.name}" data-album-timestamp="${album_date.getTime()}">`;
                        html += `<td class="album-name" scope="row">${album.name}</td>`;
                        html += `<td class="album-created-on">${album_date_timestamp}</td>`;
                        html += '<td class="album-action">'
                            html += `<button class="btn btn-primary" type="button" data-action="merge-album" data-album-id="${album.id}" data-album-name="${album.name}">`;
                                html += '<span class="btn-text">Merge Album</span>';
                                html += '<i class="btn-icon-processing"><svg class="circular"><circle class="path" cx="25" cy="25" r="10" fill="none" stroke-width="3" stroke-miterlimit="10" /></svg></i>';
                                html += '<span class="btn-processing-text">Processing</span>';
                                html += '<i class="btn-icon"><svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="16px" height="16px" viewBox="0 0 305.002 305.002" xml:space="preserve"><g><g><path d="M152.502,0.001C68.412,0.001,0,68.412,0,152.501s68.412,152.5,152.502,152.5c84.089,0,152.5-68.411,152.5-152.5 S236.591,0.001,152.502,0.001z M152.502,280.001C82.197,280.001,25,222.806,25,152.501c0-70.304,57.197-127.5,127.502-127.5 c70.304,0,127.5,57.196,127.5,127.5C280.002,222.806,222.806,280.001,152.502,280.001z"/><path d="M218.473,93.97l-90.546,90.547l-41.398-41.398c-4.882-4.881-12.796-4.881-17.678,0c-4.881,4.882-4.881,12.796,0,17.678 l50.237,50.237c2.441,2.44,5.64,3.661,8.839,3.661c3.199,0,6.398-1.221,8.839-3.661l99.385-99.385 c4.881-4.882,4.881-12.796,0-17.678C231.269,89.089,223.354,89.089,218.473,93.97z"/></g></g></svg></i>';
                            html += '</button>';
                        html += '</td>';
                    html += '</tr>';
                });

            html += '</tbody>';
        html += '</table>';
        
        const target = document.getElementById('albums');
        target.innerHTML = html;
            
        [... target.querySelectorAll('[data-action="merge-album"]')].forEach((btn) => {
            btn.onclick = async function(e) {
                try {
                    e.preventDefault();
                    this.disabled = true;
                    this.classList.add('btn-processing');

                    const response = [];
                    const fb_album_id = this.getAttribute('data-album-id');
                    const fb_album_name = this.getAttribute('data-album-name');
                    
                    const btn_text = this.getElementsByClassName('btn-processing-text')[0];
                    btn_text.innerHTML = 'Getting photos'
                    const fb_photos = await _.facebook.get_photos(fb_album_id);
                    
                    btn_text.innerHTML = 'Converting photos'
                    const new_photos = await _.convert_images_to_base64(fb_photos);
        
                    btn_text.innerHTML = 'Creating album'
                    const google_album_response = await _.google.create_album(fb_album_name);
                    const google_album_id = google_album_response.id;

                    btn_text.innerHTML = 'Uploading photos'
                    for (let i = 0; i < new_photos.length; i++) {
                        const current_new_photo = new_photos[i];
                        console.log(`Uploading photo ${i+1}/${new_photos.length} to _.google...`);
                        const upload_token = await _.google.upload_bytes(current_new_photo);
                        current_new_photo.upload_token = upload_token;
                        console.log(`Successfully uploaded photo ${i+1}/${new_photos.length} to Google`, current_new_photo);
                    }
                    
                    const max_items = 50;
                    let media_items = JSON.parse(JSON.stringify(new_photos));
                    if (media_items.length <= max_items) {
                        const create_response = await _.google.create_media_items(media_items, google_album_id)
                    }
                    else {
                        while (media_items.length > 0) {
                            const target_media_items = media_items.slice(0, 50);
                            await _.google.create_media_items(target_media_items, google_album_id);
                            media_items = media_items.slice(50);
                        }
                    }
                    
                    btn_text.innerHTML = '';
                    this.classList.remove('btn-processing');
                    this.classList.remove('btn-primary');
                    this.classList.add('btn-success');
                    
                }
                catch (err) {
                    this.disabled = false;
                    this.classList.remove('processing');
                }
            };
        });
        
        [... target.querySelectorAll('[data-action="sort_albums"]')].forEach((sort_btn) => {
            sort_btn.onclick = function(e) {
                e.preventDefault();
                const sort_by = this.getAttribute('data-sort');
                const sorted_albums = _.facebook.sort_albums(albums, sort_by);
                const node = _.facebook.display_albums(sorted_albums);
                
                [... node.querySelectorAll('[data-action="sort_albums"]')].forEach((btn) => {
                    if (sort_by === btn.getAttribute('data-sort')) {
                        btn.classList.add('active');
                    }
                    else {
                        btn.classList.remove('active');
                    }
                });
            };
        });
        
        return target;
    };
    _.facebook.request = (path, search_params) => {
        return new Promise(async (resolve, reject) => {
            try {
                const access_token = _.facebook.access_token;
                const query_string = ['access_token=' + access_token];
                (search_params || []).forEach((search_param) => {
                    query_string.push(search_param);
                });

                const endpoint = 'https://graph.facebook.com/v21.0/' + path + '?' + query_string.join('&');
                const response = await _.facebook.make_request(endpoint);
                if (response.error) {
                    reject(response.error);
                }
                else {
                    resolve(response);
                }
            }
            catch(err) {
                reject(err);
            }
        });
    };
    _.facebook.make_request = (endpoint, options) => {
        return new Promise(async (resolve, reject) => {
            try {
                const response = await fetch(endpoint);
                const response_json = await response.json();
                resolve(response_json);
            }
            catch (err) {
                reject(err);
            }
        });
    };
    _.facebook.get_albums = async () => {
        const response = [];

        // first 25 albums
        let graph_api_response = await _.facebook.request(_.facebook.user_id + '/albums');
        (graph_api_response.data || []).forEach((album) => {
            response.push(album);
        });

        // if more than 25 albums, pagination
        while (graph_api_response.paging?.next) {
            graph_api_response = await _.facebook.make_request(graph_api_response.paging.next);
            (graph_api_response.data || []).forEach((album) => {
                response.push(album);
            });
        }
        return response;
    };
    _.facebook.parse_photo = (photo) => {
        const response = {};
        response.timestamp = photo.created_time;
        if (photo.backdated_time) {
            response.timestamp = photo.backdated_time;
        }
        
        response.source = '';
        response.height = 0;
        response.width = 0;
        (photo.images || []).forEach((image) => {
            const photo_image_size = parseInt(image.height, 10) * parseInt(image.width, 10);
            const new_photo_size = parseInt(response.height, 10) * parseInt(response.width, 10);
            
            if (photo_image_size > new_photo_size) {
                response.source = image.source;
                response.height = image.height;
                response.width = image.width;
            }
        });
        
        response.caption = photo.name || '';
        response.tags = [];
        (photo.name_tags || []).forEach((name_tag) => {
            if (name_tag.name) {
                response.tags.push(name_tag.name);
            }
        });
        
        response.place = photo.place || {};
        return response;
    };
    _.facebook.get_photos = async (album_id) => {
        console.log('getting photos from Facebook...');
        const response = [];
        
        // first 25 pictures
        let graph_api_response = await _.facebook.request(album_id + '/photos', ['fields=backdated_time,created_time,images,name,name_tags,place']);
        (graph_api_response.data || []).forEach((photo) => {
            const parsed_photo = _.facebook.parse_photo(photo);
            response.push(parsed_photo);
        });

        // if more than 25 pictures, pagination
        while (graph_api_response.paging?.next) {
            graph_api_response = await _.facebook.make_request(graph_api_response.paging.next);
            (graph_api_response.data || []).forEach((photo) => {
                const parsed_photo = _.facebook.parse_photo(photo);
                response.push(parsed_photo);
            });
        }
        return response;
    };

    _.google = {};
    _.google.storage_key = 'google_response';
    _.google.is_authenticated = () => {
        return _.google.access_token ? true : false;
    };
    _.google.init = () => {
        const google_response = _.get_cookie(_.google.storage_key);
        if (google_response) {
            _.google.on_auth({ access_token: google_response });
        }
        else {
            const btn = document.getElementById('btn-google-auth');
            const hash = window.location.hash.slice(1);
            if (hash.includes('access_token=')) {
                const response = {};
                const hash_split = window.location.hash.slice(1).split('&');
                hash_split.forEach((a) => {
                    const a_split = a.split('=');
                    response[a_split[0]] = decodeURIComponent(a_split[1]);
                });
                
                window.location.hash = '';
                _.set_cookie(_.google.storage_key, response.access_token, (parseInt(response.expires_in, 10) * 1000));
                _.google.on_auth(response);
            }
            else {
                btn.onclick = (e) => {
                    e.preventDefault();
                    const params = {};
                    params.client_id = window.google_client_id;
                    params.redirect_uri = window.google_redirect_uri;
                    params.response_type = 'token';
                    params.scope = 'https://www.googleapis.com/auth/photoslibrary.appendonly';
                    params.state = Math.round(Math.random() * 1E13);
                    params.include_granted_scopes = 'true';
        
                    const query_string = Object.keys(params).map((key) => key + '=' + encodeURIComponent(params[key]));
                    window.location.href = 'https://accounts.google.com/o/oauth2/v2/auth?' + query_string.join('&');
                };
            }
        }
    };
    _.google.on_auth = (response) => {
        _.google.access_token = response.access_token;
        const auth_container = document.getElementById('auth-google');
        auth_container.classList.add('active');
        auth_container.getElementsByClassName('btn')[0].disabled = true;
        _.check_auths();
    };
    _.google.request = (path, options) => {
        return new Promise(async (resolve, reject) => {
            try {
                options = options || {};
                options.headers = options.headers || {};
                options.headers.Authorization = 'Bearer ' + _.google.access_token;

                const response = await fetch('https://photoslibrary.googleapis.com/v1/' + path, options);
                resolve(response);
            }
            catch (err) {
                reject(err);
            }
        });
    };
    _.google.create_album = (album_title) => {
        return new Promise(async (resolve, reject) => {
            console.log(`Creating "${album_title}" album in Google Photos...`);
            const options = {};
            options.method = 'POST';
            options.headers = {};
            options.headers['Content-type'] = 'application/json';
            options.body = JSON.stringify({ album: { title: album_title }});
        
            const response = await _.google.request('albums', options);
            const response_json = await response.json();
            if (!response_json) {
                reject();
            }
            else if (response_json.error) {
                reject(response_json.error.message);
            }
            else {
                console.log(`Successfully created "${album_title}" album in Google Photos.`, response_json.id);
                resolve(response_json);
            }
        });
    };
    _.google.base64_to_file = (base64_data, filename) => {
        const arr = base64_data.split(',');
        const mime = arr[0].match(/:(.*?);/)[1];
        const bstr = atob(arr[arr.length - 1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while(n--){
            u8arr[n] = bstr.charCodeAt(n);
        }
        return new File([u8arr], filename, {type:mime});
    };
    _.google.upload_bytes = async (photo) => {
        const file_url = new URL(photo.source).pathname;
        const file = file_url.split('/')[file_url.split('/').length - 1];

        const options = {};
        options.method = 'POST';
        options.headers = {};
        options.headers['Content-type'] = 'application/octet-stream';
        options.headers['X-Goog-Upload-Protocol'] = 'raw';
        options.body = _.google.base64_to_file(photo.source_base64, file);

        const response = await _.google.request('uploads', options);
        const response_raw = await response.text();
        return response_raw;
    };
    _.google.create_media_items = async (media_items, album_id) => {
        return new Promise(async (resolve, reject) => {
            const data = [];
            media_items.forEach((item) => {
                const file_url = new URL(item.source);
                const response = {};
                response.description = item.caption;
                response.simpleMediaItem = {};
                response.simpleMediaItem.fileName = file_url.pathname.split('/')[file_url.pathname.split('/').length - 1];
                response.simpleMediaItem.uploadToken = item.upload_token;
                data.push(response);
            });

            const options = {};
            options.method = 'POST';
            options.headers = {};
            options.headers['Content-type'] = 'application/json';
            options.body = JSON.stringify({ albumId: album_id, newMediaItems: data });

            console.log('Adding photos to the Google Photos account and assigning to album', JSON.parse(options.body));
            const response = await _.google.request('mediaItems:batchCreate', options);
            const response_json = await response.json();
            for (let i = 0; i < (response_json.newMediaItemResults || []).length; i++) {
                const current_item = response_json.newMediaItemResults[i];
                if (current_item.status.message !== 'Success') {
                    reject(response_json);
                }
            }
            console.log('Successfully added photos to the Google Photos account and album');
            resolve(response_json);
        });
    };
    _.init();
})()