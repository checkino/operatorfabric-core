/* Copyright (c) 2018-2021, RTE (http://www.rte-france.com)
 * See AUTHORS.txt
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * SPDX-License-Identifier: MPL-2.0
 * This file is part of the OperatorFabric project.
 */


package org.lfenergy.operatorfabric.cards.publication.services;

import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang.StringUtils;
import org.lfenergy.operatorfabric.aop.process.AopTraceType;
import org.lfenergy.operatorfabric.aop.process.mongo.models.UserActionTraceData;
import org.lfenergy.operatorfabric.cards.model.CardOperationTypeEnum;
import org.lfenergy.operatorfabric.cards.publication.model.ArchivedCardPublicationData;
import org.lfenergy.operatorfabric.cards.publication.model.CardCreationReportData;
import org.lfenergy.operatorfabric.cards.publication.model.CardPublicationData;
import org.lfenergy.operatorfabric.cards.publication.model.PublisherTypeEnum;
import org.lfenergy.operatorfabric.cards.publication.services.clients.impl.ExternalAppClientImpl;
import org.lfenergy.operatorfabric.cards.publication.services.processors.UserCardProcessor;
import org.lfenergy.operatorfabric.springtools.error.model.ApiError;
import org.lfenergy.operatorfabric.springtools.error.model.ApiErrorException;
import org.lfenergy.operatorfabric.users.model.ComputedPerimeter;
import org.lfenergy.operatorfabric.users.model.CurrentUserWithPerimeters;
import org.lfenergy.operatorfabric.users.model.RightsEnum;
import org.lfenergy.operatorfabric.users.model.User;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.validation.beanvalidation.LocalValidatorFactoryBean;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import javax.validation.ConstraintViolation;
import javax.validation.ConstraintViolationException;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.function.Consumer;

/**
 * <p>
 * Responsible of processing card : check format , save in repository and send
 * notification
 */
@Service
@Slf4j
public class CardProcessingService {


    @Autowired
    private RecipientProcessor recipientProcessor;
    @Autowired
    private LocalValidatorFactoryBean localValidatorFactoryBean;
    @Autowired
    private CardNotificationService cardNotificationService;
    @Autowired
    private CardRepositoryService cardRepositoryService;
    @Autowired
    private UserCardProcessor userCardProcessor;
    @Autowired
    private ExternalAppClientImpl externalAppClient;
    @Autowired
    private TraceReposiory traceReposiory;

    private Mono<CardCreationReportData> processCards(Flux<CardPublicationData> pushedCards, Optional<CurrentUserWithPerimeters> user) {

        long windowStart = Instant.now().toEpochMilli();

        
        //delete child cards process should be prior to cards updates
        Flux<CardPublicationData> cards = deleteChildCardsProcess(pushedCards);
        cards = registerRecipientProcess(cards);
        cards = registerValidationProcess(cards);

        if (user.isPresent()) {
            cards = userCardPublisherProcess(cards,user.get());
            cards = sendCardToExternalAppProcess(cards);
        }

        return registerPersistenceAndNotificationProcess(cards, windowStart)
                .doOnNext(count -> log.debug("{} pushed Cards persisted", count))
                .map(count -> new CardCreationReportData(count, "All pushedCards were successfully handled"))
                .onErrorResume(e -> {
                    log.error("Unexpected error during pushed Cards persistence", e);
                    return Mono.just(
                            new CardCreationReportData(0, "Error, unable to handle pushed Cards: " + e.getMessage()));
                });
    }

    private Flux<CardPublicationData> deleteChildCardsProcess(Flux<CardPublicationData> cards) {
        return cards.doOnNext(card -> {

            if (! card.getKeepChildCards()) {
                String idCard = card.getProcess() + "." + card.getProcessInstanceId();
                Optional<List<CardPublicationData>> childCard = cardRepositoryService.findChildCard(cardRepositoryService.findCardById(idCard));
                if (childCard.isPresent()) {
                    deleteCards(childCard.get());
                }
            }
        });
    }



    public Mono<CardCreationReportData> processCards(Flux<CardPublicationData> pushedCards) {
        return processCards(pushedCards, Optional.empty());
    }

    public Mono<CardCreationReportData> processUserCards(Flux<CardPublicationData> pushedCards, CurrentUserWithPerimeters user) {
        return processCards(pushedCards, Optional.of(user));
    }


    private Flux<CardPublicationData> registerRecipientProcess(Flux<CardPublicationData> cards) {
        return cards.doOnNext(ignoreErrorDo(recipientProcessor::processAll));
    }

    private Flux<CardPublicationData> userCardPublisherProcess(Flux<CardPublicationData> cards, CurrentUserWithPerimeters user) {
        return cards.doOnNext(card-> userCardProcessor.processPublisher(card,user));
    }

    private Flux<CardPublicationData> sendCardToExternalAppProcess(Flux<CardPublicationData> cards) {
        return cards.doOnNext(card-> externalAppClient.sendCardToExternalApplication(card));
    }

    private static Consumer<CardPublicationData> ignoreErrorDo(Consumer<CardPublicationData> onNext) {
        return c -> {
            try {
                onNext.accept(c);
            } catch (Exception e) {
                log.warn("Error arose and will be ignored", e);
            }
        };
    }

    /**
     * Registers validation process in flux. If an error arise it breaks the
     * process.
     *
     * @param cards
     * @return
     */
    private Flux<CardPublicationData> registerValidationProcess(Flux<CardPublicationData> cards) {
        return cards
                // prepare card computed data (id, shardkey)
                .doOnNext(c -> c.prepare(Instant.ofEpochMilli(Math.round(Instant.now().toEpochMilli() / 1000d) * 1000)))
                // JSR303 bean validation of card
                .doOnNext(this::validate);
    }

    /**
     * Apply bean validation to card
     *
     * @param c
     * @throws ConstraintViolationException if there is an error during validation
     *                                      based on object annotation configuration
     */
    void validate(CardPublicationData c) throws ConstraintViolationException {

        // constraint check : parentCardId must exist
        if (!checkIsParentCardIdExisting(c))
            throw new ConstraintViolationException("The parentCardId " + c.getParentCardId() + " is not the id of any card", null);

        // constraint check : initialParentCardUid must exist
        if (!checkIsInitialParentCardUidExisting(c))
            throw new ConstraintViolationException("The initialParentCardUid " + c.getInitialParentCardUid() + " is not the uid of any card", null);

        Set<ConstraintViolation<CardPublicationData>> results = localValidatorFactoryBean.validate(c);
        if (!results.isEmpty())
            throw new ConstraintViolationException(results);

        // constraint check : endDate must be after startDate
        if (! checkIsEndDateAfterStartDate(c))
            throw new ConstraintViolationException("constraint violation : endDate must be after startDate", null);

        // constraint check : timeSpans list : each end date must be after his start date
        if (! checkIsAllTimeSpanEndDateAfterStartDate(c))
            throw new ConstraintViolationException("constraint violation : TimeSpan.end must be after TimeSpan.start", null);

        // constraint check : process and state must not contain "." (because we use it as a separator)
        if (! checkIsDotCharacterNotInProcessAndState(c))
            throw new ConstraintViolationException("constraint violation : character '.' is forbidden in process and state", null);
    }

    boolean checkIsParentCardIdExisting(CardPublicationData c){
        String parentCardId = c.getParentCardId();

        return ! ((Optional.ofNullable(parentCardId).isPresent()) && (cardRepositoryService.findCardById(parentCardId) == null));
    }

    //The check of existence of uid is done in archivedCards collection
    boolean checkIsInitialParentCardUidExisting(CardPublicationData c){
        String initialParentCardUid = c.getInitialParentCardUid();

        return ! ((Optional.ofNullable(initialParentCardUid).isPresent()) &&
                  (! cardRepositoryService.findArchivedCardByUid(initialParentCardUid).isPresent()));
    }

    boolean checkIsEndDateAfterStartDate(CardPublicationData c) {
        Instant endDateInstant = c.getEndDate();
        Instant startDateInstant = c.getStartDate();
        return ! ((endDateInstant != null) && (startDateInstant != null) && (endDateInstant.compareTo(startDateInstant) < 0));
    }

    boolean checkIsDotCharacterNotInProcessAndState(CardPublicationData c) {
        return ! ((c.getProcess() != null && c.getProcess().contains(Character.toString('.'))) ||
                  (c.getState() != null && c.getState().contains(Character.toString('.'))));
    }

    boolean checkIsAllTimeSpanEndDateAfterStartDate(CardPublicationData c) {
        if (c.getTimeSpans() != null) {
            for (int i = 0; i < c.getTimeSpans().size(); i++) {
                if (c.getTimeSpans().get(i) != null) {
                    Instant endInstant = c.getTimeSpans().get(i).getEnd();
                    Instant startInstant = c.getTimeSpans().get(i).getStart();
                    if ((endInstant != null) && (startInstant != null) && (endInstant.compareTo(startInstant) < 0))
                        return false;
                }
            }
        }
        return true;
    }

    /**
     * Save and notify card
     *
     * @param cards
     * @param windowStart
     * @return
     */
    private Mono<Integer>  registerPersistenceAndNotificationProcess(Flux<CardPublicationData> cards, long windowStart) {

        return cards.doOnNext(card -> {
            cardRepositoryService.saveCard(card);
            cardRepositoryService.saveCardToArchive(new ArchivedCardPublicationData(card));
            cardNotificationService.notifyOneCard(card, CardOperationTypeEnum.ADD);
        }).reduce(0, (count, card) -> count + 1).doOnNext(size -> {
            if (size > 0 && log.isDebugEnabled()) {
                logMeasures(windowStart, size);
            }
        });
    }

    public void deleteCards(List<CardPublicationData> cardPublicationData) {
        cardPublicationData.forEach(x->deleteCard(x.getId()));
    }

    public Optional<CardPublicationData> deleteCard(String id) {
        CardPublicationData cardToDelete = cardRepositoryService.findCardById(id);
        return deleteCard0(cardToDelete);
    }

    public Optional<CardPublicationData> deleteCard(CardPublicationData card) {
        if (StringUtils.isEmpty(card.getId())) {
            card.prepare(card.getPublishDate());
        }
        return deleteCard0(card);
    }

    public Optional<CardPublicationData> deleteUserCard(String id, CurrentUserWithPerimeters user) {
        CardPublicationData cardToDelete = cardRepositoryService.findCardById(id);
        if (cardToDelete == null)
            return Optional.empty();
        if (isUserAllowedToDeleteThisCard(cardToDelete, user)){
            return deleteCard0(cardToDelete);
        }
        else {
            throw new ApiErrorException(ApiError.builder()
                    .status(HttpStatus.FORBIDDEN)
                    .message("User not allowed to delete this card")
                    .build());
        }
    }

    public Optional<CardPublicationData> deleteCard0(CardPublicationData cardToDelete) {
        Optional<CardPublicationData> deletedCard = Optional.ofNullable(cardToDelete);
        if (null != cardToDelete) {
            cardNotificationService.notifyOneCard(cardToDelete, CardOperationTypeEnum.DELETE);
            cardRepositoryService.deleteCard(cardToDelete);
            Optional<List<CardPublicationData>> childCard=cardRepositoryService.findChildCard(cardToDelete);
            if(childCard.isPresent()){
                childCard.get().forEach(x->deleteCard(x.getId()));
            }
        }
        return deletedCard;
    }

    /* 1st check : card.publisherType == ENTITY
       2nd check : the card has been sent by an entity of the user connected
       3rd check : the user has the Write access to the process/state of the card */
    public boolean isUserAllowedToDeleteThisCard(CardPublicationData card, CurrentUserWithPerimeters user) {
        List<ComputedPerimeter> perimetersOfTheUserList = user.getComputedPerimeters();
        List<String>            entitiesOfTheUserList   = user.getUserData().getEntities();

        if ((card.getPublisherType() == PublisherTypeEnum.ENTITY) &&
            (entitiesOfTheUserList.contains(card.getPublisher()))){

            for (ComputedPerimeter perimeter : perimetersOfTheUserList) {
                if ((perimeter.getProcess().equals(card.getProcess())) &&
                    (perimeter.getState().equals(card.getState())) &&
                    ((perimeter.getRights() == RightsEnum.WRITE) || (perimeter.getRights() == RightsEnum.RECEIVEANDWRITE)))
                    return true;
            }
        }
        return false;
    }

	public Mono<UserBasedOperationResult> processUserAcknowledgement(Mono<String> cardUid, User user) {
		return cardUid.map(uid -> cardRepositoryService.addUserAck(user, uid));
	}

	public Mono<UserBasedOperationResult> processUserRead(Mono<String> cardUid, String userName) {
		return cardUid.map(uid -> cardRepositoryService.addUserRead(userName, uid));
    }

    public Mono<UserBasedOperationResult> deleteUserRead(Mono<String> cardUid, String userName) {
		return cardUid.map(_cardUid -> cardRepositoryService.deleteUserRead(userName, _cardUid));
	}

    /**
     * Logs card count and elapsed time since window start
     *
     * @param windowStart
     * @param count
     */
    private void logMeasures(long windowStart, long count) {
        long windowDuration = System.nanoTime() - windowStart;
        double windowDurationMillis = windowDuration / 1000000d;
        double cardWindowDurationMillis = windowDurationMillis / count;
        log.debug("{} cards handled in {} ms each (total: {})", count, cardWindowDurationMillis, windowDurationMillis);
    }

	public Mono<UserBasedOperationResult> deleteUserAcknowledgement(Mono<String> cardUid, String userName) {
		return cardUid.map(_cardUid -> cardRepositoryService.deleteUserAck(userName, _cardUid));
	}

    public Mono<UserActionTraceData> findTraceByCardUid(String name, String cardUid) {
        return traceReposiory.findByCardUidAndActionAndUserName(cardUid, AopTraceType.ACK.getAction(),name);
    }

	
}
