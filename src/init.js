/* eslint-disable max-len */
/* eslint-disable no-param-reassign */
import 'bootstrap';
import axios from 'axios';
import i18n from 'i18next';
import _ from 'lodash';
import * as yup from 'yup';
import resources from './locales/index.js';
import parser from './parser.js';
import watch from './view.js';

const getProxyUrl = (link) => `https://allorigins.hexlet.app/get?disableCache=true&url=${encodeURIComponent(link)}`;

const updatePosts = (watchedState) => {
  const promises = watchedState.addedFeeds.map((link) => {
    const proxyUrl = getProxyUrl(link);

    return axios.get(proxyUrl)
      .then((res) => {
        const {
          title, description, posts,
        } = parser(res.data.contents);

        const existingFeed = watchedState.data.feeds
          .find((feed) => (feed.title === title) && (feed.description === description));

        const existingPosts = watchedState.data.posts
          .filter(({ feedId }) => feedId === existingFeed.id);

        const newPosts = _.unionBy(existingPosts, posts, 'link')
          .filter((post) => !post.feedId)
          .map((post) => ({
            id: _.uniqueId(),
            title: post.title,
            link: post.link,
            description: post.description,
            feedId: existingFeed.id,
          }));

        if (newPosts.length !== 0) {
          watchedState.data.posts.push(...newPosts);
        }
      })
      .catch(() => {
        watchedState.processState = 'error';
        watchedState.error = 'erorrs.netWorkErorr';
      });
  });

  Promise.all(promises).finally(() => setTimeout(() => updatePosts(watchedState), 5000));
};

const loadRss = (watchedState, url) => {
  const proxyUrl = getProxyUrl(url);

  axios.get(proxyUrl)
    .then((res) => {
      if (res.status === 200) {
        watchedState.processState = 'success';
        watchedState.error = 'successfully';

        const normalized = parser(res.data.contents);

        watchedState.addedFeeds.push(url);

        const feedId = _.uniqueId();

        const postsWithIds = normalized.posts.map(({ title, link, description }) => ({
          feedId, title, link, id: _.uniqueId(), description,
        }));

        watchedState.data.feeds = [...watchedState.data.feeds, { id: feedId, title: normalized.title, description: normalized.description }];

        watchedState.data.posts = [...watchedState.data.posts, ...postsWithIds];
      }
    })
    .catch((err) => {
      if (err.isParsingError) {
        watchedState.processState = 'error';
        watchedState.error = 'erorrs.notContainValidRss';
        return;
      }
      watchedState.processState = 'error';
      watchedState.error = 'erorrs.netWorkErorr';
    });
};

const validateUrl = (watchedState, url) => {
  const schema = yup.string().url().nullable().notOneOf(watchedState.addedFeeds, 'rssExist');
  return schema.validate(url);
};

export default () => {
  const elements = {
    outputError: document.querySelector('#error-input'),
    input: document.querySelector('#url-input'),
    form: document.querySelector('form'),
    submitButton: document.querySelector('button[type="submit"]'),
    posts: document.querySelector('#posts'),
    feeds: document.querySelector('#feeds'),
    modal: document.querySelector('#modal'),
  };

  const i18nInstance = i18n.createInstance();
  i18nInstance
    .init({
      lng: 'ru',
      debug: false,
      resources,
    });

  yup.setLocale({
    string: {
      url: i18nInstance.t('yupErorrs.url'),
    },
  });

  const state = {
    processState: 'filling',
    error: '',
    modal: null,
    uiState: {
      shownPosts: [],
    },
    addedFeeds: [],
    data: {
      posts: [],
      feeds: [],
    },
  };

  const watchedState = watch(state, elements, i18nInstance);

  elements.form.addEventListener('submit', (e) => {
    e.preventDefault();

    const formData = new FormData(e.target);
    const url = formData.get('url');

    validateUrl(watchedState, url)
      .then(() => {
        watchedState.error = '';
        watchedState.processState = 'sending';

        loadRss(watchedState, url);
      })
      .catch((err) => {
        if (err.message === 'rssExist') {
          watchedState.processState = 'error';
          watchedState.error = 'erorrs.rssExist';
          return;
        }

        watchedState.processState = 'error';
        watchedState.error = 'erorrs.notValid';
      });
  });

  elements.posts.addEventListener('click', (e) => {
    const { id } = e.target.dataset;

    if (id) {
      watchedState.uiState.shownPosts.push(id);
      watchedState.modal = id;
    }
  });

  setTimeout(() => updatePosts(watchedState), 5000);
};
