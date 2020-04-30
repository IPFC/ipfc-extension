<template>
  <div :class="showCardBacks ? 'flashcard' : flipped ? 'flip-container flipped' : 'flip-container'">
    <div
      :style="showCardBacks ? null : frontStyle"
      :class="showCardBacks ? '' : 'front flipper flashcard'"
    >
      <div
        :class="showCardBacks ? 'card-content-show-back' : 'card-content'"
        @click="cardClicked()"
      >
        <b-img-lazy v-if="card.front_image" class="card-image" :src="card.front_image"></b-img-lazy>
        <p :class="card.front_image ? 'text-with-img' : ''" class="card-text front-text">
          {{ card.front_text }}
        </p>
        <font-awesome-icon
          v-if="collectCard"
          icon="plus-square"
          :class="showCardBacks ? 'collect-btn-show-backs' : 'collect-btn'"
          @click="$emit('collect-card-clicked')"
        />
        <font-awesome-icon
          v-else
          icon="edit"
          :class="showCardBacks ? 'edit-btn-show-backs' : 'edit-btn'"
          @click="$emit('edit-clicked')"
        />
      </div>
    </div>
    <hr v-if="showCardBacks" class="divider" />
    <div ref="flashcardBack" :class="showCardBacks ? '' : 'back flashcard'">
      <div
        :class="showCardBacks ? 'card-content-show-back' : 'card-content'"
        @click="cardClicked()"
      >
        <b-img-lazy v-if="card.back_image" class="card-image" :src="card.back_image"></b-img-lazy>
        <p :class="card.back_image ? 'text-with-img' : ''" class="card-text back-text">
          {{ card.back_text }}
        </p>
      </div>
    </div>
  </div>
</template>
<script>
import { BImgLazy } from 'bootstrap-vue';

export default {
  components: { BImgLazy },
  props: {
    card: {
      type: Object,
      default() {
        return {
          front_text: '',
          back_text: '',
        };
      },
    },
    clickedCardId: { type: String, default: '' },
    showCardBacks: { type: Boolean, default: false },
    collectCard: { type: Boolean, default: false },
  },
  data() {
    return {
      flipped: false,
      frontStyle: {
        height: '150px',
      },
    };
  },
  mounted() {
    // console.log(this.$refs.flashcardBack.clientHeight);
    const backHeight = this.$refs.flashcardBack.clientHeight;
    // *1.05 to match the 'selected' transform
    const joined = backHeight * 1.05 + 'px';
    this.frontStyle.height = joined;
  },
  methods: {
    cardClicked() {
      this.$emit('card-clicked');
      if (!this.showCardBacks && this.clickedCardId === this.card.card_id)
        this.flipped = !this.flipped;
    },
  },
};
</script>

<style scoped>
.flashcard {
  align-content: center;
  justify-content: center;
  border-radius: 10px;
  box-shadow: 0 0px 10px rgba(0, 0, 0, 0.4);
  margin: auto;
  width: 100%;
  padding: 0px 5px 0px 10px;
  background-color: white;
  visibility: visible;
}
.flashcard:hover {
  box-shadow: 0 0px 25px rgba(0, 0, 0, 0.8);
}
.card-content {
  margin: 0px 16px 0 0;
  padding-top: 10px;
  overflow-y: auto;
  position: relative;
  height: 100%;
  max-height: 12em;
  display: flex;
  cursor: pointer;
}
.card-content-show-back {
  padding-top: 10px;
  overflow-y: auto;
  position: relative;
  height: 100%;
  max-height: 8em;
  display: flex;
}
.card-content::-webkit-scrollbar {
  width: 0.5em;
}
.card-content::-webkit-scrollbar-thumb {
  background-color: rgba(162, 162, 162, 0.5);
  border-radius: 5px;
}
.card-content-show-back::-webkit-scrollbar {
  width: 0.5em;
}
.card-content-show-back::-webkit-scrollbar-thumb {
  background-color: rgba(162, 162, 162, 0.5);
  border-radius: 5px;
}
.card-image {
  width: 50%;
  object-fit: contain;
}
.text-with-img {
  width: 50%;
}
.front-text {
  font-weight: bold;
  margin-right: 5px;
}
.edit-btn-show-backs {
  margin-left: auto;
  margin-right: 5px;
  color: grey;
}
.edit-btn-show-backs:hover {
  color: rgb(36, 36, 36);
  cursor: pointer;
}
.edit-btn {
  position: fixed;
  top: 5px;
  right: 3px;
  color: grey;
}
.edit-btn:hover {
  color: rgb(36, 36, 36);
  cursor: pointer;
}
.collect-btn-show-backs {
  margin-left: auto;
  margin-right: 5px;
  height: 18px;
  width: 18px;
  color: #f8690d;
}
.collect-btn-show-backs:hover {
  color: #9a3c02;
  cursor: pointer;
}
.collect-btn {
  position: fixed;
  top: 5px;
  right: 5px;
  height: 18px;
  width: 18px;
  color: #f8690d;
}
.collect-btn:hover {
  color: #9a3c02;
  cursor: pointer;
}
.flip-container {
  border-radius: 10px;
  -webkit-perspective: 1000;
  -moz-perspective: 1000;
  -o-perspective: 1000;
  perspective: 1000;
}
.flipper {
  -moz-transform: perspective(1000px);
  -moz-transform-style: preserve-3d;
  transform: perspective(1000px);
  transform-style: preserve-3d;
  position: relative;
  height: 100%;
}
.front,
.back {
  -webkit-backface-visibility: hidden;
  -moz-backface-visibility: hidden;
  -o-backface-visibility: hidden;
  backface-visibility: hidden;
  -webkit-transition: 0.6s;
  -webkit-transform-style: preserve-3d;
  -moz-transition: 0.6s;
  -moz-transform-style: preserve-3d;
  -o-transition: 0.6s;
  -o-transform-style: preserve-3d;
  -ms-transition: 0.6s;
  -ms-transform-style: preserve-3d;
  transition: 0.6s;
  transform-style: preserve-3d;
  top: 0;
  left: 0;
  width: 100%;
}
.back {
  -webkit-transform: rotateY(-180deg);
  -moz-transform: rotateY(-180deg);
  -o-transform: rotateY(-180deg);
  -ms-transform: rotateY(-180deg);
  transform: rotateY(-180deg);
  height: 12em;
  margin-top: -12em;
}
.flip-container {
  visibility: hidden;
}
.flip-container.flipped .back {
  -webkit-transform: rotateY(0deg);
  -moz-transform: rotateY(0deg);
  -o-transform: rotateY(0deg);
  -ms-transform: rotateY(0deg);
  transform: rotateY(0deg);
}
.flip-container.flipped .front {
  -webkit-transform: rotateY(180deg);
  -moz-transform: rotateY(180deg);
  -o-transform: rotateY(180deg);
  -ms-transform: rotateY(180deg);
  transform: rotateY(180deg);
}
</style>
