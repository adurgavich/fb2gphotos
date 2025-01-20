# fb2gphotos
Migrate Facebook photo albums to Google Photos keeping exil data such as timestamps, comments, and geolocation

# Demo site
https://fb2gphotos.adurgavich.com/
![alt text](https://github.com/adurgavich/fb2gphotos/blob/master/screenshot.jpg?raw=true)

# Prerequisites to deploying/hosting yourself
1. Create a Facebook App (https://developers.facebook.com/apps/) and find your App ID
    - Ensure "Facebook Login" is enabled with "Web OAuth login".
    - Ensure "Login with the JavaScript SDK" is enabled.
    - Ensure your domain is in the "Allowed Domains for the JavaScript SDK".
2. Create a Google Cloud project and obtain your OAuth client ID and specify your website as an Authorized JavaScript origin
    - Instructions outlined here https://developers.google.com/identity/protocols/oauth2/javascript-implicit-flow

# Steps to deploy on your own website
1. Download the reposity
2. In `config.js`, replace
    - `{{facebook_app_id}}` with your Facebook App ID
    - `{{google_client_id}}` with your Google Cloud OAuth client ID
    - `{{google_redirect_uri}}` with your Google Cloud Authorized JavaScript origin (your website URL)
3. Upload the files to your website
4. Visit your website
5. Authenticate with Facebook and Google
6. Choose which albums you want to merge
