import { Realtime, Rest } from '@firecamp/cloud-apis';
import {
  TId,
  IRest,
  IGraphQL,
  IRestResponse,
  ISocketIO,
  IWebSocket,
  EHttpMethod,
} from '@firecamp/types';
import * as executor from '@firecamp/agent-manager';
import { IRequestTab } from '../../components/tabs/types';
import { platformEmitter } from '../platform-emitter';
import { promptSaveItem } from './prompt.service';
import { prepareEventNameForRequestPull } from '../platform-emitter/events';
import AppService from '../app.service';
import { useTabStore } from '../../store/tab';
import { useWorkspaceStore } from '../../store/workspace';
import { usePlatformStore } from '../../store/platform';
import { useEnvStore } from '../../store/environment';

interface IPlatformRequestService {
  // subscribe real-time request changes (pull-actions from server)
  subscribeChanges?: (requestId: TId, handlePull: () => any) => void;

  // unsubscribe real-time request changes (pull-actions from server)
  unsubscribeChanges?: (requestId: TId) => void;

  // save and update request
  save: (request: any, tabId: TId, isNew?: boolean) => Promise<any>;

  // on change request, update tab __meta
  onChangeRequestTab: (
    tabId: TId,
    tabMeta: IRequestTab['__meta'],
    request?: IRest | IGraphQL | ISocketIO | IWebSocket
  ) => void;

  // fetch request from server by request id
  onFetch: (reqId: TId) => Promise<any>;

  // get executor
  execute: (request: IRest) => Promise<IRestResponse>;
  cancelExecution: (reqId: TId) => Promise<any>;
}

const request: IPlatformRequestService = {
  // subscribe real-time request changes (pull-actions from server)
  subscribeChanges: (requestId: TId, handlePull: () => any) => {
    // TODO: manage user is logged in from store
    // if (!F.userMeta.isLoggedIn) return;

    // console.log({ subscribeChanges: requestId });

    // Subscribe request changes
    Realtime.subscribeRequest(requestId);

    // listen/ subscribe updates
    platformEmitter.on(prepareEventNameForRequestPull(requestId), handlePull);
  },

  // unsubscribe real-time request changes (pull-actions from server)
  unsubscribeChanges: (requestId: TId) => {
    // TODO: handle isLoggedIn
    // if (!F.userMeta.isLoggedIn) return;

    // console.log({ unsubscribeChanges: requestId });

    // unsubscribe request changes
    // Realtime.unsubscribeRequest(requestId); // TODO: add socket API
    platformEmitter.off(prepareEventNameForRequestPull(requestId));
  },

  /**
   * Open save request modal if request is newly created
   * if request is already saved then update request with chanes/payload
   */
  save: async (request: any, tabId: TId, isNew: boolean = false) => {
    if (!AppService.user.isLoggedIn()) {
      return AppService.modals.openSignIn();
    }
    const { onNewRequestCreate, workspace } = useWorkspaceStore.getState();
    const tabState = useTabStore.getState();
    const {
      explorer: { collections, folders },
    } = useWorkspaceStore.getState();
    try {
      const _request = {
        ...request,
        __ref: {
          ...request.__ref,
          workspaceId: workspace.__ref.id,
        },
      };
      // console.log(workspace, 132456789);
      if (isNew === true) {
        return promptSaveItem({
          header: 'Save Request',
          texts: { btnOk: 'Save', btnOking: 'Saving...' },
          collection: {
            items: [...collections, ...folders],
            rootOrders: workspace.__meta.cOrders,
          },
          value: '',
          validator: ({ value, itemId }) => {
            let isValid = false,
              message = '';
            if (!value) message = 'The request name is required';
            if (!itemId)
              message =
                'Please select the colletion/folder to save the request.';
            else if (value.length < 3) {
              message = 'The request name must have min 3 characters';
            } else {
              isValid = true;
            }
            // TODO: add regex validation
            return { isValid, message };
          },
          executor: async ({ value, itemId }) => {
            if (!itemId) throw 'The path is not selected';
            const item = [...collections, ...folders].find(
              (i) => i.__ref.id == itemId
            );
            if (!item)
              throw 'The collection/folder you have selected is not found';
            const collectionId = item.__ref.collectionId || item.__ref.id;
            const folderId = item.__ref.collectionId
              ? item.__ref.id
              : undefined;
            console.log(item, 'res...');
            _request.__meta.name = value;
            _request.__meta.description = '0;';
            _request.__ref.collectionId = collectionId;
            if (folderId) _request.__ref.folderId = folderId;
            const { data } = await Rest.request.create(_request);
            return _request;
          },
        })
          .then(async (_request) => {
            // console.log(_request, '_request...');
            return _request;
          })
          .then((_request) => {
            // reflect in explorer
            onNewRequestCreate(_request);
            return _request;
          })
          .then((_request) => {
            tabState.changeRootKeys(tabId, {
              name: _request.__meta?.name,
              type: _request.__meta?.type || '',
              request: {
                url: _request.url,
                method: _request.method || EHttpMethod.POST,
                __meta: _request.__meta,
                __ref: _request.__ref,
              },
              __meta: {
                isSaved: true,
                hasChange: false,
                isFresh: false,
                isDeleted: false,
                revision: 1,
              },
            });
            // TODO: // update tab meta on save request
            // tabState.changeMeta(tabId, {
            //   isSaved: true,
            //   hasChange: false,
            //   isFresh: false,
            // });

            return _request;
          });
      } else {
        // TODO: Update request
        // const { data } = await Rest.request.update(_request.__ref.id, _request);
      }
      // return Promise.resolve(response);
    } catch (error) {
      console.error({
        fn: 'onSaveRequest',
        request,
        error,
      });
      // return Promise.reject(error);
    }
  },

  // fetch request from server by request id
  onFetch: async (reqId: TId) => {
    return await Rest.request.findOne(reqId);
  },

  // on change request
  onChangeRequestTab: (
    tabId: TId,
    tabMeta: IRequestTab['__meta'],
    request?: IRest | IGraphQL // | ISocket | IWebsocket,
  ) => {
    // Here, request and pushActions are used for future purpose
    // console.log({ tabMeta });

    useTabStore.getState().changeMeta(tabId, tabMeta);
  },

  // execute request
  execute: async (request: IRest) => {
    const agent = usePlatformStore.getState().getFirecampAgent();
    const env = useEnvStore.getState().getActiveTabEnv();
    const vars = env ? env.variables : {};
    return executor.send(request, agent);
  },

  cancelExecution: (reqId: TId) => {
    const agent = usePlatformStore.getState().getFirecampAgent();
    return executor.cancel(reqId, agent);
  },
};

export { IPlatformRequestService, request };
