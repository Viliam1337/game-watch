import {
    Button,
    Flex,
    FormControl,
    FormLabel,
    Input,
    Modal,
    ModalBody,
    ModalCloseButton,
    ModalContent,
    ModalFooter,
    ModalHeader,
    ModalOverlay,
    Select,
    useDisclosure,
} from '@chakra-ui/react';
import { InfoSourceType } from '@game-watch/shared';
import React, { useRef, useState } from 'react';

import { useGameContext } from '../../providers/GameProvider';
import { useUserContext } from '../../providers/UserProvider';
import { useAction } from '../../util/useAction';
import { PlaceholderMap } from '../AddGameModal';

export const AddInfoSource: React.FC = () => {
    const { user: { interestedInSources } } = useUserContext();

    const { addInfoSource, activeInfoSources } = useGameContext();
    const { isOpen, onOpen, onClose } = useDisclosure();

    const availableInfoSources = interestedInSources.filter(
        type => activeInfoSources.find(source => source.type === type) === undefined
    );

    const [type, setType] = useState(availableInfoSources[0] ?? '');
    const [url, setUrl] = useState('');

    const initialRef = useRef(null);

    const { loading, execute: onAdd } = useAction(addInfoSource, {
        onSuccess: () => {
            onClose();
            setUrl('');
        }
    });

    return (
        <>
            <Modal
                size="xl"
                isOpen={isOpen}
                onClose={onClose}
                initialFocusRef={initialRef}
            >
                <ModalOverlay />
                <ModalContent>
                    <ModalHeader>Add new InfoSource</ModalHeader>
                    <ModalCloseButton />
                    <ModalBody pb={6}>
                        <Flex>
                            <FormControl flex="0.5" mr="1rem">
                                <FormLabel>Type</FormLabel>
                                <Select
                                    onChange={evt => setType(evt.target.value as InfoSourceType)}
                                >
                                    {availableInfoSources.map(type => (
                                        <option key={type} value={type}>{type}</option>
                                    ))}
                                </Select>
                            </FormControl>
                            <FormControl flex="1">
                                <FormLabel>Url</FormLabel>
                                <Input
                                    value={url}
                                    disabled={loading}
                                    placeholder={PlaceholderMap[type]}
                                    onChange={event => setUrl(event.target.value)}
                                    ref={initialRef} />
                            </FormControl>
                        </Flex>
                    </ModalBody>
                    <ModalFooter>
                        <Button onClick={onClose} mr="1rem">Cancel</Button>
                        <Button
                            isLoading={loading}
                            colorScheme="teal"
                            onClick={() => onAdd({ type, url })}
                        >
                            Add
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>
            {availableInfoSources.length > 0 &&
                <Flex justify="center">
                    <Button onClick={onOpen}>
                        +
                    </Button>
                </Flex>
            }
        </>
    );
};
