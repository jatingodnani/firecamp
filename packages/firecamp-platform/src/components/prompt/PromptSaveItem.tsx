import { FC, useRef, useState } from 'react';
import {
  Button,
  Container,
  Input,
  Modal,
  ProgressBar,
  TabHeader,
} from '@firecamp/ui-kit';
import { Tree, UncontrolledTreeEnvironment } from '@firecamp/ui-kit/src/tree';

import { TreeDataProvider } from './tree/dataProvider';
import treeRenderer from './tree/itemRenderer';

export interface IPromptInput {
  header: string;
  lable?: string;
  placeholder?: string;
  texts?: {
    btnOk?: string;
    btnOking?: string;
    btnCancle?: string;
  };
  value: string;
  onClose: Function;
  validator?: (value: string) => { isValid: boolean; message?: string };
  executor?: (value: string) => Promise<any>;
  onResolve: (res: any) => void;
  onError?: (e) => void;
}

const _texts: IPromptInput['texts'] = {
  btnOk: 'Create',
  btnOking: 'Creating...',
  btnCancle: 'Cancle',
};

export const PromptSaveItem: FC<IPromptInput> = ({
  header,
  lable = 'Name',
  placeholder,
  texts,
  value,
  items,
  onClose,
  validator,
  executor,
  onResolve,
  onError,
}) => {
  const [state, setState] = useState({
    isOpen: true,
    isExecuting: false,
    value,
    error: '',
  });
  const _close = (e) => {
    setState((s) => ({ ...s, isOpen: false }));
    setTimeout(() => {
      onClose(e);
    }, 500);
  };
  const _onChangeValue = (e) => {
    const { value } = e.target;
    setState((s) => ({ ...s, value, error: '' }));
  };
  const _onClickOk = async (e) => {
    e.preventDefault();
    const value = state.value.trim();
    let _validator: { isValid: boolean; message?: string } = { isValid: true };
    if (typeof validator == 'function') _validator = validator(value);
    // console.log(_validator, '_validator');
    if (_validator.isValid == false) {
      setState((s) => ({ ...s, error: _validator.message }));
      if (typeof onError == 'function') onError(new Error(_validator.message));
    } else {
      if (typeof executor == 'function') {
        setState((s) => ({ ...s, error: '', isExecuting: true }));
        executor(value)
          .then((res) => {
            onResolve(res);
            // finally close the prompt on success
            setState((s) => ({ ...s, isOpen: false, isExecuting: false }));
          })
          .catch((e) => {
            if (typeof onError == 'function') {
              console.error(e);
              onError(e);
            }
            setState((s) => ({
              ...s,
              isExecuting: false,
              error: e?.response?.data?.message || e.message,
            }));
          });
      } else {
        onResolve(value);
        // finally close the prompt on success
        setState((s) => ({ ...s, error: '', isOpen: false }));
      }
    }
  };

  texts = { ..._texts, ...texts };
  return (
    <Modal
      isOpen={state.isOpen}
      onClose={_close}
      height="250px"
      width={'400px'}
    >
      <Modal.Body>
        <ProgressBar active={state.isExecuting} />
        <div className="p-6">
          <label className="text-sm font-semibold leading-3 block text-appForegroundInActive uppercase w-full relative mb-2">
            {header || `THIS IS A HEADER PLACE`}
          </label>
          <div className="mt-4">
            <Input
              autoFocus={true}
              label={lable}
              placeholder={placeholder}
              name={'prompInput'}
              value={state.value}
              onChange={_onChangeValue}
              onKeyDown={() => {}}
              onBlur={() => {}}
              error={state.error}
            />
          </div>
          <PathSelector
            onSelect={(__ref) => {
              // console.log({ __ref });
              // setRequest((r) => ({ ...r, ...__ref }));
            }}
            items={items}
          />
          <TabHeader className="px-4">
            <TabHeader.Right>
              <Button
                text={texts?.btnCancle || `Cancel`}
                onClick={_close}
                sm
                secondary
                transparent
                ghost
              />
              <Button
                text={
                  state.isExecuting ? texts?.btnOking : texts?.btnOk || 'Create'
                }
                onClick={_onClickOk}
                disabled={state.isExecuting}
                primary
                sm
              />
            </TabHeader.Right>
          </TabHeader>
        </div>
      </Modal.Body>
    </Modal>
  );
};

const PathSelector: FC<{ onSelect: (_: any) => void; items: any[] }> = ({
  onSelect,
  items = [],
}) => {
  const rootOrders = items
    .filter((i) => !i.__ref.folderId)
    .map((i) => i.__ref.id);
  const dataProvider = useRef(new TreeDataProvider(items, rootOrders));
  const onItemSelect = (itemIds: string[], treeId: string) => {
    if (!itemIds?.length) return;
    const selectedItem = itemIds[0];
    console.log(selectedItem);
  };

  return (
    <Container className="max-h-48 mb-14 !h-fit">
      <label className="text-appForeground text-sm mb-1 block">
        Select collection or folder
      </label>
      <div className="border border-appBorder">
        <Container.Body className="save-modal-collection pane-body  visible-scrollbar overflow-visible">
          <UncontrolledTreeEnvironment
            keyboardBindings={{
              // primaryAction: ['f3'],
              renameItem: ['enter', 'f2'],
              abortRenameItem: ['esc'],
            }}
            // dataProvider={new StaticTreeDataProvider(items, (item, data) => ({ ...item, data }))}
            dataProvider={dataProvider.current}
            onStartRenamingItem={(a) => {
              console.log(a, 'onStartRenamingItem');
            }}
            onSelectItems={onItemSelect}
            getItemTitle={(item) => item.data?.name}
            viewState={{}}
            // renderItemTitle={({ title }) => <span>{title}</span>}
            renderItemArrow={treeRenderer.renderItemArrow}
            // renderItemTitle={treeRenderer.renderItemTitle}
            renderItem={treeRenderer.renderItem}
            // renderTreeContainer={({ children, containerProps }) => <div {...containerProps}>{children}</div>}
            // renderItemsContainer={({ children, containerProps }) => <ul {...containerProps}>{children}</ul>}
          >
            <Tree
              treeId="collection-selector-save-request"
              rootItem="root"
              treeLabel="Collections Explorer"
            />
          </UncontrolledTreeEnvironment>
        </Container.Body>
        <Container.Header className="bg-focus2 !p-1 text-appForegroundInActive leading-3">
          Path
        </Container.Header>
      </div>
    </Container>
  );
};
