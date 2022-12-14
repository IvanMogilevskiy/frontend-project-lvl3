/* eslint-disable no-param-reassign, no-console  */

import i18next from 'i18next';
import axios from 'axios';
import onChange from 'on-change';
import uniqueId from 'lodash/uniqueId.js';
import parse from './parser.js';
import ru from './locales/ru.js';
import validateUrl from './validateUrl.js';
import render from './view.js';
import updatePosts from './updatePosts.js';
import makeProxyUrl from './makeProxyUrl.js';

export default () => {
  const elements = {
    form: document.querySelector('.rss-form'),
    input: document.getElementById('url-input'),
    submitButton: document.querySelector('button[type="submit"]'),
    feedback: document.querySelector('.feedback'),
    feedsContainer: document.querySelector('.feeds'),
    postsContainer: document.querySelector('.posts'),
    modal: document.getElementById('modal'),
    modalTitle: document.querySelector('.modal-title'),
    modalBody: document.querySelector('.modal-body'),
    modalReadButton: document.querySelector('a.full-article'),
    modalCloseButton: document.querySelector('button.btn-secondary'),
  };

  const state = {
    form: {
      processState: 'filling',
      errors: '',
    },
    addedFeeds: [],
    posts: [],
    uiState: {
      viewedPostsId: new Set(),
      modalId: '',
    },
  };

  const i18n = i18next.createInstance();
  i18n.init({
    lng: 'ru',
    debug: true,
    resources: {
      ru,
    },
  }).then(() => {
    const watchedState = onChange(state, render(state, elements, i18n));

    elements.form.addEventListener('submit', (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const url = formData.get('url');
      const urls = watchedState.addedFeeds.map((feed) => feed.link);
      validateUrl(url, urls)
        .then(() => {
          watchedState.form.errors = '';
          watchedState.form.processState = 'adding';

          return axios.get(makeProxyUrl(url));
        })
        .then((response) => {
          const { feed, posts } = parse(response.data.contents);
          feed.id = uniqueId();
          feed.link = url;
          posts.forEach((post) => {
            post.feedId = feed.id;
            post.id = uniqueId();
          });
          watchedState.addedFeeds = [feed, ...watchedState.addedFeeds];
          watchedState.posts = [...posts, ...watchedState.posts];
          watchedState.form.processState = 'added';
        })
        .catch((err) => {
          watchedState.form.processState = 'error';
          if (err.name === 'ValidationError') {
            watchedState.form.errors = err.message;
          } else if (err.response) {
            watchedState.form.errors = 'errors.networkError';
          } else if (err.message === 'parsingError') {
            watchedState.form.errors = 'errors.parsingError';
          }
          watchedState.form.processState = 'filling';
        });
    });

    elements.postsContainer.addEventListener('click', (e) => {
      watchedState.uiState.viewedPostsId.add(e.target.dataset.id);
      if (e.target.type === 'button') {
        watchedState.uiState.modalId = e.target.dataset.id;
      }
    });

    setTimeout(() => updatePosts(watchedState), 5000);
  });
};
