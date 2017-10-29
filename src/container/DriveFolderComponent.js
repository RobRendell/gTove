import React, {Component} from 'react'
import PropTypes from 'prop-types';

class DriveFolderComponent extends Component {

    static propTypes = {
        onSignOut: PropTypes.func.isRequired
    };

    componentDidMount() {
        global.gapi.client.drive.files.list({
            'pageSize': 10,
            'fields': "nextPageToken, files(id, name)"
        }).then(function(response) {
            console.log('Files:');
            let files = response.result.files;
            if (files && files.length > 0) {
                for (let i = 0; i < files.length; i++) {
                    let file = files[i];
                    console.log(file.name + ' (' + file.id + ')');
                }
            } else {
                console.log('No files found.');
            }
        });
    }

    render() {
        if (this.props.folderId) {
            return (
                <div>
                    <br/>
                    <button onClick={this.props.onSignOut}>Sign out</button>
                </div>
            );
        } else {
            return (
                <div>
                    You need to nominate a Google Drive folder where Virtual Gaming Tabletop can save its data.
                    <br/>
                    <button onClick={this.props.onSignOut}>Sign out</button>
                </div>
            );
        }

    }
}

export default DriveFolderComponent;