// @flow

import { Helmet } from 'react-helmet-async';
import NavigationTab, { NavigationLink } from 'app/components/NavigationTab';
import type { Element } from 'react';
import { Component, cloneElement } from 'react';
import GalleryDetailsRow from './GalleryDetailsRow';
import EmptyState from 'app/components/EmptyState';
import ImageUpload from 'app/components/Upload/ImageUpload';
import { Content } from 'app/components/Content';
import Gallery from 'app/components/Gallery';
import type { DropFile } from 'app/components/Upload/ImageUpload';
import type { ID, ActionGrant } from 'app/models';
import type { GalleryPictureEntity } from 'app/reducers/galleryPictures';
import Button from 'app/components/Button';
import JsZip from 'jszip';
import FileSaver from 'file-saver';
import LoadingIndicator from 'app/components/LoadingIndicator';

type Props = {
  gallery: Object,
  loggedIn: boolean,
  currentUser: boolean,
  pictures: Array<GalleryPictureEntity>,
  hasMore: boolean,
  fetching: boolean,
  children: Element<*>,
  fetch: (galleryId: Number, args: { next: boolean }) => Promise<*>,
  fetchAll: (galleryId: Number) => Promise<*>,
  push: (string) => Promise<*>,
  uploadAndCreateGalleryPicture: (ID, File | Array<DropFile>) => Promise<*>,
  actionGrant: ActionGrant,
};

type State = {
  upload: boolean,
  downloading: boolean,
};

export default class GalleryDetail extends Component<Props, State> {
  state = {
    upload: false,
    downloading: false,
  };

  toggleUpload = (response?: File | Array<DropFile>) => {
    if (response) {
      this.props.uploadAndCreateGalleryPicture(this.props.gallery.id, response);
    }

    this.setState({ upload: !this.state.upload });
  };

  handleClick = (picture: Object) => {
    this.props.push(`/photos/${this.props.gallery.id}/picture/${picture.id}`);
  };

  downloadGallery = () => {
    this.setState({ downloading: true });
    const finishDownload = () => this.setState({ downloading: false });
    // Make sure all pictures are fetched before download and zipping
    this.props
      .fetchAll(this.props.gallery.id)
      .then((allPictures) => {
        // Extract filenames from urls (a little hacky, should get from backend)
        const names = allPictures.map((picture) =>
          picture.file.split('/').pop()
        );
        const urls = allPictures.map((picture) => picture.rawFile);
        this.downloadFiles(urls)
          .then((blobs) =>
            this.zipFiles(this.props.gallery.title, names, blobs).finally(
              finishDownload
            )
          )
          .catch(finishDownload);
      })
      .catch(finishDownload);
  };

  downloadFiles = (urls: string[]) =>
    Promise.all(
      urls.map(async (url) => await fetch(url).then((res) => res.blob()))
    );

  zipFiles = (zipTitle: string, fileNames: string[], blobs: Blob[]) => {
    const zip = JsZip();
    blobs.forEach((blob, i) => {
      zip.file(fileNames[i], blob);
    });
    return zip
      .generateAsync({ type: 'blob' })
      .then((zipFile) => FileSaver.saveAs(zipFile, `${zipTitle}.zip`));
  };

  render() {
    const {
      gallery,
      pictures,
      children,
      push,
      loggedIn,
      currentUser,
      hasMore,
      fetch,
      fetching,
    } = this.props;
    const actionGrant = gallery && gallery.actionGrant;

    return (
      <Content>
        <Helmet title={gallery.title} />
        <NavigationTab
          title={gallery.title}
          details={
            <>
              <GalleryDetailsRow gallery={gallery} showDescription />
              <div style={{ minHeight: '40px' }}>
                {this.state.downloading ? (
                  <LoadingIndicator loading={true} small margin={0} />
                ) : (
                  <Button flat={true} onClick={this.downloadGallery}>
                    Last ned album
                  </Button>
                )}
              </div>
            </>
          }
        >
          <NavigationLink
            onClick={(e: Event) => {
              // TODO fix this hack when react-router is done
              if (!window.location.hash) return;
              window.history.back();
              e.preventDefault();
            }}
            to="/photos"
          >
            <i className="fa fa-angle-left" /> Tilbake
          </NavigationLink>
          {actionGrant && actionGrant.includes('edit') && (
            <div>
              <NavigationLink to="#" onClick={() => this.toggleUpload()}>
                Last opp bilder
              </NavigationLink>
              <NavigationLink to={`/photos/${gallery.id}/edit`}>
                Rediger
              </NavigationLink>
            </div>
          )}
        </NavigationTab>
        <Gallery
          photos={pictures}
          hasMore={hasMore}
          fetching={fetching}
          fetchNext={() => fetch(gallery.id, { next: true })}
          onClick={this.handleClick}
          srcKey="file"
          renderEmpty={() => (
            <EmptyState icon="photos-outline">
              <h1>Ingen bilder</h1>
              <h4>
                Trykk{' '}
                <Button flat onClick={() => this.toggleUpload()}>
                  <b>her</b>
                </Button>{' '}
                for å legge inn bilder
              </h4>
            </EmptyState>
          )}
        />

        {this.state.upload && (
          <ImageUpload
            inModal
            multiple
            crop={false}
            onClose={this.toggleUpload}
            onSubmit={this.toggleUpload}
          />
        )}

        {children &&
          cloneElement(children, { gallery, push, loggedIn, currentUser })}
      </Content>
    );
  }
}
